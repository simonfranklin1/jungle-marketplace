import { DEMO, expect, test } from './support'

// 5. Carrinho: quantidades, remoção, cupom e persistência após refresh/login.
test.describe('Carrinho', () => {
  test('visitante: quantidade, cupom, remoção e persistência; itens mantidos após login @mobile', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
    await expect(app.toast('Emerald Ape #042 (1/50) adicionado ao carrinho.')).toBeVisible()
    await app.goto('/nft/violet-nomad-314')
    await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()

    await app.goto('/carrinho')
    const rowEmerald = page.locator('section[aria-labelledby=cart-items] li').filter({ hasText: 'Emerald Ape #042' })
    await rowEmerald.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(rowEmerald.locator('output')).toHaveText('2')
    const summary = page.locator('aside dl')
    // 1.19 x 2 + 1.39 = 3.77; taxa 0.016
    await expect(summary).toContainText('3.77 ETH')
    await expect(summary).toContainText('3.786 ETH')

    // cupom inválido, expirado e válido
    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('errado')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.locator('#coupon-error')).toHaveText('Cupom inválido.')
    await coupon.fill('EXPIRADO')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.locator('#coupon-error')).toHaveText('Este cupom expirou.')
    await coupon.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary).toContainText('(-) 0.377 ETH') // 10% de 3.77
    await expect(summary).toContainText('3.409 ETH') // 3.77 - 0.377 + 0.016

    // remoção
    await page.getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' }).click()
    await expect(page.locator('section[aria-labelledby=cart-items] li').filter({ hasText: 'Violet Nomad #314' })).toHaveCount(0)

    // refresh mantém carrinho e cupom
    await page.reload()
    await expect(rowEmerald.locator('output')).toHaveText('2')
    await expect(page.getByText('KURIO10')).toBeVisible()

    // login mescla o carrinho de visitante ao da conta
    await app.loginUI(DEMO)
    await expect(app.toast('Os itens do seu carrinho foram mantidos.')).toBeVisible()
    await app.goto('/carrinho') // no mobile o login passa pela rota /perfil
    await expect(rowEmerald.locator('output')).toHaveText('2')
  })

  test('remover cupom recalcula o total', async ({ app, page }) => {
    await app.goto('/')
    await app.loginAPI()
    await app.seedCart([{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }], 'KURIO10')
    await app.goto('/carrinho')
    const summary = page.locator('aside dl')
    await expect(summary).toContainText('(-) 0.119 ETH')
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(summary).toContainText('(-) 0.00 ETH')
    await expect(summary).toContainText('1.206 ETH')
  })
})
