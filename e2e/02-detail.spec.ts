import { expect, test } from './support'

// 2. Acesso direto ao detalhe e tratamento de recursos inexistentes (+ edição esgotada e limite).
test.describe('Detalhe do NFT', () => {
  test('acesso direto mostra dados do NFT e respeita o limite de quantidade @mobile', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByText('1.19 ETH').first()).toBeVisible()

    // edição 1/1: só 1 por pedido
    await page.locator('label').filter({ hasText: /^1\/1$/ }).click()
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
    await expect(page.getByText('Máximo de 1 por pedido')).toBeVisible()

    // edição 1/50: limite de 10 por pedido
    await page.locator('label').filter({ hasText: /^1\/50$/ }).click()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 0; i < 12; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByLabel('Quantidade selecionada')).toHaveText('10')
  })

  test('NFT inexistente e rota inexistente mostram 404', async ({ app, page }) => {
    await app.goto('/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao mercado' }).click()
    await expect(page).toHaveURL(/\/mercado/)

    await app.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('NFT esgotado: edições desabilitadas e compra bloqueada', async ({ app, page }) => {
    await app.goto('/')
    // o último NFT do catálogo determinístico começa esgotado
    const { data } = await app.api<{ items: { id: string; available: number }[] }>('/api/nfts?page=5&pageSize=9', undefined, 'GET')
    const soldOut = data.items.find((i) => i.available === 0)!
    await app.goto(`/nft/${soldOut.id}`)
    await expect(page.getByRole('button', { name: 'ESGOTADO' })).toBeDisabled()
    for (const value of ['1-1', '1-10', '1-50', 'open']) await expect(page.locator(`input[value="${value}"]`)).toBeDisabled()
  })
})
