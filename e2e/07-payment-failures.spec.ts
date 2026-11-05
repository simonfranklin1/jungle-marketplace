import type { Page } from '@playwright/test'
import { connectWalletAtCheckout, expect, test, type App } from './support'

// 7. Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido.
async function orderCount(page: Page) {
  return page.evaluate(() => (JSON.parse(localStorage.getItem('kurio:mockdb') ?? '{}').orders ?? []).length as number)
}

async function prepareCheckout(app: App) {
  await app.goto('/')
  await app.loginAPI()
  await app.seedCart([{ nftId: 'ivory-baron-088', editionId: '1-50', quantity: 1 }])
  await app.goto('/checkout')
  await connectWalletAtCheckout(app.page)
}

test.describe('Falhas no pagamento', () => {
  test('pagamento recusado mostra o estado rejeitado e preserva o carrinho', async ({ app, page }) => {
    await prepareCheckout(app)
    await app.scenario('payment-rejected')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.locator('section[aria-labelledby=cart-items] li').filter({ hasText: 'Ivory Baron #088' })).toBeVisible()
  })

  test('cliques repetidos em "Confirmar compra" criam um único pedido', async ({ app, page }) => {
    await prepareCheckout(app)
    const before = await orderCount(page)
    const confirm = page.getByRole('button', { name: 'Confirmar compra' })
    await confirm.click()
    // cliques extras imediatos (o botão já está desabilitado / a página pode ter navegado)
    await confirm.click({ force: true, timeout: 500 }).catch(() => {})
    await confirm.click({ force: true, timeout: 500 }).catch(() => {})
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 20_000 })
    expect(await orderCount(page)).toBe(before + 1)
  })

  test('timeout após criar o pedido: a nova tentativa reaproveita a mesma chave e o mesmo pedido', async ({ app, page }) => {
    await prepareCheckout(app)
    await app.scenario('order-timeout')
    const before = await orderCount(page)
    const keys: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/orders')) keys.push(r.headers()['idempotency-key'])
    })
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    // o servidor confirma (e esvazia o carrinho) antes da resposta atrasada: a tela continua no
    // pagamento, informando a nova tentativa — nunca troca para "carrinho vazio"
    await expect(page.getByText('Resposta demorou; verificando o pedido com a mesma chave…')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 30_000 })
    // a 1ª resposta expirou (timeout); a 2ª tentativa usou a MESMA chave e recebeu o pedido já criado
    expect(keys.length).toBeGreaterThanOrEqual(2)
    expect(new Set(keys).size).toBe(1)
    expect(await orderCount(page)).toBe(before + 1)
  })

  test('idempotência no servidor: mesma chave e outro conteúdo gera conflito', async ({ app }) => {
    await app.goto('/')
    const token = await app.loginAPI()
    const base = {
      items: [{ nftId: 'golden-signal-160', editionId: 'open', quantity: 1 }],
      coupon: null,
      network: 'ethereum',
      walletType: 'metamask',
      walletAddress: '0x' + 'a'.repeat(40),
      buyer: {},
    }
    const quote = await app.api<{ totalEth: string }>('/api/quote', { items: base.items, network: 'ethereum' })
    const send = (body: unknown) =>
      app.page.evaluate(
        async ({ body, token }) => {
          const r = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': 'e2e-fixed-key-123' },
            body: JSON.stringify(body),
          })
          return { status: r.status, body: await r.json() }
        },
        { body, token },
      )
    const first = await send({ ...base, expectedTotalEth: quote.data.totalEth })
    const again = await send({ ...base, expectedTotalEth: quote.data.totalEth })
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(again.body.id).toBe(first.body.id)
    const conflict = await send({ ...base, items: [{ ...base.items[0], quantity: 2 }], expectedTotalEth: quote.data.totalEth })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})
