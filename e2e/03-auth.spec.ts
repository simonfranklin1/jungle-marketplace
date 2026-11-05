import { ANA, DEMO, expect, test } from './support'

// 3. Cadastro, login, expiração de sessão, logout e troca de usuário.
test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso; sessão sobrevive ao refresh', async ({ app, page }) => {
    await app.goto('/')
    await page.locator('header').getByRole('button', { name: 'Entrar' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: 'Criar conta' }).click()

    // validação local associada aos campos
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(dialog.getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByText('Informe seu nome (mín. 2 caracteres).')).toBeVisible()

    // conflito vindo da API (e-mail já cadastrado)
    await dialog.getByLabel('Nome de exibição').fill('Nova Pessoa')
    await dialog.getByLabel('E-mail').fill(DEMO.email)
    await dialog.getByLabel('Senha', { exact: true }).fill('Senha1234')
    await dialog.getByLabel('Confirmar senha').fill('Senha1234')
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(dialog.getByText('E-mail já cadastrado.')).toBeVisible()

    // sucesso
    await dialog.getByLabel('E-mail').fill('nova.pessoa@kurio.test')
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('header').getByRole('link', { name: /Meu perfil \(Nova Pessoa\)/ })).toBeVisible()

    await page.reload()
    await expect(page.locator('header').getByRole('link', { name: /Meu perfil \(Nova Pessoa\)/ })).toBeVisible()
  })

  test('login inválido, login válido e logout', async ({ app, page }) => {
    await app.goto('/')
    await page.locator('header').getByRole('button', { name: 'Entrar' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(DEMO.email)
    await dialog.getByLabel('Senha', { exact: true }).fill('senha-errada1')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')

    await dialog.getByLabel('Senha', { exact: true }).fill(DEMO.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.locator('header').getByRole('button', { name: 'Sair da conta' }).click()
    await expect(page.locator('header').getByRole('button', { name: 'Entrar' })).toBeVisible()
    expect(await app.token()).toBeUndefined()
  })

  test('sessão expira durante a navegação (relógio controlado) e o contexto é retomado', async ({ app, page }) => {
    await page.clock.install()
    await app.goto('/', { scenario: 'session-expired' }) // TTL de 30s
    await app.loginUI(DEMO)
    await app.goto('/nft/emerald-ape-042')
    await page.clock.fastForward('00:40') // avança o relógio além da validade da sessão
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Sua sessão expirou')
    // reautentica no mesmo lugar: a página continua a mesma
    await dialog.getByLabel('E-mail').fill(DEMO.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(DEMO.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
  })

  test('rota privada sem sessão pede login e volta para o destino', async ({ app, page }) => {
    await app.goto('/perfil/carteiras')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Entre para acessar seu perfil.')
    await dialog.getByLabel('E-mail').fill(DEMO.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(DEMO.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil\/carteiras/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('troca de usuário não vaza carrinho nem favoritos', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI(DEMO)
    await app.seedCart([{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 }])
    await app.api('/api/favorites/emerald-ape-042', undefined, 'PUT', await app.token())
    await page.reload()
    await expect(page.locator('header').getByRole('link', { name: /Carrinho, 2 itens/ })).toBeVisible()

    await page.locator('header').getByRole('button', { name: 'Sair da conta' }).click()
    await app.loginUI(ANA)
    await expect(page.locator('header').getByRole('link', { name: /Carrinho, 0 itens/ })).toBeVisible()
    await app.goto('/perfil/favoritos')
    await expect(page.getByText('Nenhum NFT favoritado ainda')).toBeVisible()
  })
})
