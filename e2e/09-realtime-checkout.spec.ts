import { connectWalletAtCheckout, expect, test } from './support'

// 9. Mudança de preço/disponibilidade via Socket.IO durante o checkout.
test.describe('Tempo real no carrinho e no checkout', () => {
  test('preço muda pelo Socket.IO no checkout: resumo atualiza e a compra usa a cotação nova', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }])
    await app.goto('/checkout')
    await app.waitRealtime()
    const summary = page.locator('aside dl')
    await expect(summary).toContainText('1.206 ETH') // 1.19 + 0.016
    await connectWalletAtCheckout(page)

    // evento nft.updated emitido pelo servidor simulado e recebido pelo socket.io-client
    await app.realtime('price', { nftId: 'emerald-ape-042' }) // +0.10
    await expect(app.toast(/Item do seu carrinho mudou/)).toBeVisible()
    await expect(page.getByTestId('live-announcer')).toContainText('Emerald Ape #042: preço atualizado para 1.29 ETH')
    await expect(summary).toContainText('1.306 ETH')

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.locator('article')).toContainText('1.306 ETH')
  })

  test('preço muda no momento da confirmação: bloqueia e exige nova confirmação', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'ivory-baron-088', editionId: '1-50', quantity: 1 }])
    await app.goto('/checkout')
    await connectWalletAtCheckout(page)
    await app.scenario('price-change')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'O total mudou de 1.806 ETH para 1.856 ETH' })).toBeVisible()
    await expect(page).toHaveURL(/\/checkout/) // nada foi comprado
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.locator('article')).toContainText('1.856 ETH')
  })

  test('edição esgota pelo Socket.IO com o carrinho aberto: aviso e finalização bloqueada @mobile', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'golden-beat-207', editionId: '1-50', quantity: 1 }])
    await app.goto('/carrinho')
    await app.waitRealtime()
    const finalize = page.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(finalize).toBeEnabled()
    await app.realtime('stock', { nftId: 'golden-beat-207', editionId: '1-50', available: 0 })
    await expect(page.getByText('Esta edição esgotou.')).toBeVisible()
    await expect(finalize).toBeDisabled()
  })
})
