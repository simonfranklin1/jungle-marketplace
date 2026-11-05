import type { Page } from '@playwright/test'
import { connectWalletAtCheckout, expect, test } from './support'

// 10. Eventos duplicados ou antigos, desconexão e retomada de um pedido pendente.
const priceOnPage = (page: Page) => page.locator('main h1 + div p').first()

test.describe('Eventos em tempo real', () => {
  test('evento duplicado e evento antigo são ignorados; evento novo é aplicado', async ({ app, page }) => {
    await app.goto('/nft/sage-nomad-009')
    await app.waitRealtime()
    await expect(priceOnPage(page)).toContainText('1.69 ETH')

    await app.realtime('price', { nftId: 'sage-nomad-009' }) // versão nova: 1.79
    await expect(priceOnPage(page)).toContainText('1.79 ETH')

    await app.realtime('stale', { nftId: 'sage-nomad-009' }) // versão antiga com preço 999
    await app.realtime('duplicate') // reenvia o último evento (mesmo id)
    await page.waitForTimeout(1000)
    await expect(priceOnPage(page)).toContainText('1.79 ETH')
    await expect(priceOnPage(page)).not.toContainText('999')
  })

  test('após cair a conexão, o app reconecta e reconcilia com a REST o que perdeu', async ({ app, page }) => {
    await app.goto('/nft/violet-nomad-314')
    await app.waitRealtime()
    await expect(priceOnPage(page)).toContainText('1.39 ETH')

    // derruba o socket e muda o preço enquanto o cliente está desconectado (evento perdido)
    await app.realtime('disconnect')
    await app.realtime('price', { nftId: 'violet-nomad-314' })
    await app.waitRealtime() // reconectou sozinho
    await expect(priceOnPage(page)).toContainText('1.49 ETH') // veio do refetch REST
  })

  test('pedido pendente é retomado após recarregar a página, sem criar outra compra', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'golden-signal-160', editionId: 'open', quantity: 1 }])
    await app.goto('/checkout')
    await connectWalletAtCheckout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.getByRole('heading', { name: 'Processando seu pedido na rede…' })).toBeVisible()
    const url = page.url()

    await page.reload() // interrupção enquanto pendente
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio:mockdb') ?? '{}').orders.length)
    expect(orders).toBe(1)
  })
})
