import { ANA, expect, test } from './support'

// 8. Edição de perfil, avatar, senha e carteiras, incluindo erros de validação.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Perfil e carteiras', () => {
  test('dados, avatar e senha com erros vindos da API @mobile', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI(ANA)
    await app.goto('/perfil')
    const form = page.locator('main form')

    // validação local
    await form.getByLabel('Nome de exibição *').fill('A')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Informe o nome de exibição.')).toBeVisible()

    // conflito da API: nome de usuário de outra conta
    await form.getByLabel('Nome de exibição *').fill('Ana Atualizada')
    await form.getByLabel('Nome de usuário *').fill('demo')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Nome de usuário indisponível.')).toBeVisible()

    await form.getByLabel('Nome de usuário *').fill('ana_atualizada')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.toast('Perfil atualizado.')).toBeVisible()

    // avatar
    await page.getByLabel('Escolher imagem de avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1X1 })
    await expect(page.getByRole('img', { name: 'Avatar de Ana Atualizada' })).toBeVisible()

    // senha atual errada -> erro no campo; depois troca com sucesso
    await form.getByLabel('Senha atual').fill('errada123')
    await form.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await form.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Senha atual incorreta.')).toBeVisible()
    await form.getByLabel('Senha atual').fill(ANA.password)
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.toast('Perfil e senha atualizados.')).toBeVisible()

    // alterações persistem após refresh e a nova senha funciona
    await page.reload()
    await expect(form.getByLabel('Nome de exibição *')).toHaveValue('Ana Atualizada')
    const login = await app.api('/api/auth/login', { email: ANA.email, password: 'NovaSenha1' })
    expect(login.status).toBe(200)
  })

  test('carteiras principal e secundária: validação, conflito e edição', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI(ANA)
    await app.goto('/perfil/carteiras')
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    const primary = page.getByRole('form', { name: 'Dados da carteira principal' })
    await primary.getByLabel('Apelido da carteira *').fill('Ana principal')
    await primary.getByLabel('Endereço da carteira *').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText(/Endereço inválido/)).toBeVisible()
    await primary.getByLabel('Endereço da carteira *').fill('0x' + 'b'.repeat(40))
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.toast('Carteira adicionada.')).toBeVisible()

    // secundária com o mesmo endereço -> conflito do servidor
    await page.getByLabel('Igual à carteira principal').check()
    const secondary = page.getByRole('form', { name: 'Dados da carteira secundária' })
    await secondary.getByLabel('Endereço da carteira *').fill('0x' + 'b'.repeat(40))
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Endereço já cadastrado.')).toBeVisible()

    // edição da principal persiste
    await primary.getByLabel('Apelido da carteira *').fill('Ana editada')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.toast('Carteira atualizada.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Dados da carteira principal' }).getByLabel('Apelido da carteira *')).toHaveValue('Ana editada')
  })
})
