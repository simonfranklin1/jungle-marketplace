import { expect, test } from './support'

// 1. Busca, filtros combinados, ordenação, paginação e restauração pelo histórico.
test.describe('Catálogo', () => {
  test('filtros combinados ficam na URL, resetam a página e sobrevivem a refresh/histórico @mobile', async ({ app, page }) => {
    await app.goto('/mercado')
    const status = page.locator('#catalogo [role=status]')
    await expect(status).toContainText('45 NFTs encontrados, página 1 de 5')

    // paginação
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(status).toContainText('página 2 de 5')

    // filtro de rede (no mobile fica na gaveta de filtros)
    const mobile = (page.viewportSize()?.width ?? 1440) < 768
    if (mobile) await page.getByRole('button', { name: 'Abrir filtros' }).click()
    const filters = mobile ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Filtros' })
    await filters.getByRole('button', { name: /^Polygon/ }).click()
    await expect(page).toHaveURL(/network=polygon/)
    await expect(page).not.toHaveURL(/page=/) // mudar filtro volta para a página 1
    const afterNetwork = await status.textContent()

    // combina com categoria
    await filters.getByRole('button', { name: /^Fotografia/ }).click()
    await expect(page).toHaveURL(/category=fotografia/)
    await expect(page).toHaveURL(/network=polygon/)
    await expect(status).not.toHaveText(afterNetwork ?? '')
    if (mobile) await page.keyboard.press('Escape')

    // ordenação por maior preço: os preços aparecem em ordem decrescente
    await app.goto('/mercado?sort=price-desc')
    await expect(page.locator('#catalogo article')).toHaveCount(9)
    const prices = await page.locator('#catalogo article p.font-bold span.text-primary').allTextContents()
    const values = prices.map((p) => Number(p.replace(' ETH', '')))
    expect(values.length).toBeGreaterThan(1)
    expect([...values].sort((a, b) => b - a)).toEqual(values)

    // histórico: voltar restaura o estado anterior (filtros combinados)
    await page.goBack()
    await expect(page).toHaveURL(/category=fotografia/)
    await expect(page).toHaveURL(/network=polygon/)

    // refresh mantém tudo
    await page.reload()
    await expect(page).toHaveURL(/category=fotografia/)
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Polygon')
  })

  test('busca por texto e resultado vazio', async ({ app, page }) => {
    await app.goto('/')
    await page.locator('header').getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByLabel('Termo de busca').fill('golden')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page).toHaveURL(/\/mercado\?q=golden/)
    await expect(page.locator('#catalogo [role=status]')).toContainText('NFTs encontrados')
    const names = await page.locator('#catalogo article h3').allTextContents()
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) expect(n.toLowerCase()).toContain('golden')

    await page.goto('/mercado?q=nao-existe-nada')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('link', { name: 'Limpar filtros' }).click()
    await expect(page.locator('#catalogo [role=status]')).toContainText('45 NFTs')
  })

  test('parâmetros inválidos na URL são ignorados sem quebrar a página', async ({ app, page }) => {
    await app.goto('/mercado?page=abc&category=xyz&sort=foo')
    await expect(page.locator('#catalogo [role=status]')).toContainText('45 NFTs encontrados, página 1')
  })
})
