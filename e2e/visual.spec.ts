import type { Page } from '@playwright/test'
import { expect, test } from './support'

/**
 * Regressão visual com baselines versionadas em e2e/__screenshots__.
 * Dados estáveis: catálogo determinístico, ticker desligado, animações desativadas.
 * Atualize com `npm run test:e2e:update` quando o visual mudar de propósito.
 */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    // só imagens na viewport (as "lazy" fora da tela nunca carregam)
    const visible = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect()
      return !i.complete && r.top < innerHeight && r.bottom > 0
    })
    await Promise.race([
      Promise.all(visible.map((i) => new Promise((r) => ((i.onload = r), (i.onerror = r))))),
      new Promise((r) => setTimeout(r, 5000)),
    ])
  })
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
}

test.describe('Regressão visual @mobile', () => {
  test('home', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.locator('#catalogo article')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('home.png')
  })

  test('detalhe do NFT', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detail.png')
  })

  test('carrinho', async ({ app, page }) => {
    await app.goto('/')
    await page.evaluate(() =>
      localStorage.setItem(
        'kurio:guest-cart',
        JSON.stringify({
          items: [
            { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
            { nftId: 'violet-nomad-314', editionId: '1-50', quantity: 1 },
          ],
          coupon: null,
        }),
      ),
    )
    await app.goto('/carrinho')
    await expect(page.locator('aside dl')).toContainText('3.786 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('cart.png')
  })

  test('pagamento', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 }])
    await app.goto('/checkout')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await settle(page)
    await expect(page).toHaveScreenshot('checkout.png')
  })
})
