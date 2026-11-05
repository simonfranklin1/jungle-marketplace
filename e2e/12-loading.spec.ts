import { expect, test } from './support'

// 12. Skeletons durante carregamento lento, feedback de falha e recuperação após nova tentativa.
test.describe('Carregamento e falhas', () => {
  test('carregamento lento mostra skeletons com shimmer e depois o conteúdo @mobile', async ({ app, page }) => {
    await app.goto('/mercado', { scenario: 'slow' })
    await expect(page.locator('#catalogo [aria-busy="true"] .shimmer').first()).toBeVisible()
    await expect(page.locator('#catalogo article').first()).toBeVisible({ timeout: 15_000 })

    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
  })

  test('falha no catálogo mostra erro e recupera ao tentar novamente', async ({ app, page }) => {
    await app.goto('/mercado', { scenario: 'catalog-error' })
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })
    await expect(alert).toBeVisible({ timeout: 15_000 }) // após os retries automáticos
    await app.scenario('default')
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('#catalogo article').first()).toBeVisible()
    await expect(alert).toBeHidden()
  })

  test('sem conexão: erro claro e recuperação quando a rede volta', async ({ app, page }) => {
    await app.goto('/nft/ivory-baron-088', { scenario: 'offline' })
    await expect(page.getByText('Não foi possível carregar este NFT.')).toBeVisible({ timeout: 15_000 })
    await app.scenario('default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible()
  })

  test('falha transitória na primeira tentativa é recuperada sozinha (retry)', async ({ app, page }) => {
    await app.goto('/mercado', { scenario: 'flaky' })
    await expect(page.locator('#catalogo article').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
