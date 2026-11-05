import { DEMO, connectWalletAtCheckout, expect, test } from './support'

// 6. Compra completa: do catálogo ao recibo confirmado.
test('compra completa do catálogo até o recibo confirmado @mobile', async ({ app, page }) => {
  await app.goto('/mercado')
  await page.locator('#catalogo article').filter({ hasText: 'Golden Beat #207' }).getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
  await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
  await app.goto('/carrinho')
  await expect(page.locator('aside dl')).toContainText('1.006 ETH') // 0.99 + 0.016

  // visitante: finalizar pede login e volta para o checkout
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill(DEMO.email)
  await dialog.getByLabel(/^Senha\*?$/).fill(DEMO.password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout/)

  // dados do perfil já preenchidos; conecta a carteira cadastrada e confirma
  await expect(page.getByLabel(/^Nome de exibição\*?$/)).toHaveValue(DEMO.name)
  await connectWalletAtCheckout(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  // pendente -> confirmado (evento order.updated pelo Socket.IO)
  await expect(page).toHaveURL(/\/pedido\/ord_/)
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
  const receipt = page.locator('article')
  await expect(receipt).toContainText('ID da transação')
  await expect(receipt).toContainText('Golden Beat #207')
  await expect(receipt).toContainText('0.016 ETH')
  await expect(receipt).toContainText('1.006 ETH')

  // o recibo é um snapshot: continua igual após refresh, mesmo se o preço mudar depois
  await app.realtime('price', { nftId: 'golden-beat-207' })
  await page.reload()
  await expect(page.locator('article')).toContainText('1.006 ETH')
  // o item comprado saiu do carrinho
  await expect(page.getByRole('link', { name: /Carrinho, 0 itens/ }).first()).toBeAttached()
})
