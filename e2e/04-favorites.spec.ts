import { expect, test } from './support'

// 4. Favoritos, incluindo falha de mutação e recuperação do estado (rollback otimista).
test.describe('Favoritos', () => {
  test('visitante é convidado a entrar e o favorito é aplicado após o login', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Entre para salvar NFTs nos seus favoritos.')
    await dialog.getByLabel('E-mail').fill('demo@kurio.test')
    await dialog.getByLabel('Senha', { exact: true }).fill('Kurio@123')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('favorito persiste após refresh e aparece na lista de interesse', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(app.toast('Adicionado aos favoritos.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    await app.goto('/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Sage Nomad #009' })).toBeVisible()
  })

  test('falha ao salvar desfaz a atualização otimista e avisa o usuário', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.goto('/nft/emerald-ape-042')
    await app.scenario('favorites-error')
    const btn = page.getByRole('button', { name: /^(Favoritar|Favoritado)$/ })
    await btn.click()
    await expect(app.toast('Não foi possível atualizar seus favoritos.')).toBeVisible()
    await expect(btn).toHaveAttribute('aria-pressed', 'false') // rollback
    // recuperação: com o serviço normal, a ação funciona
    await app.scenario('default')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
