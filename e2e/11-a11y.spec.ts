import { expect, test } from './support'

// 11. Navegação por teclado, foco em diálogos e validação de formulários.
test.describe('Acessibilidade', () => {
  test('primeiro Tab leva ao "pular para o conteúdo"', async ({ app, page }) => {
    await app.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)
  })

  test('modal de login: abre pelo teclado, prende o foco, fecha com Esc e devolve o foco', async ({ app, page }) => {
    await app.goto('/')
    const trigger = page.locator('header').getByRole('button', { name: 'Entrar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // o foco nunca sai do diálogo, mesmo após muitos Tabs. O Base UI usa "guardas" de foco nas
    // pontas: por um instante o foco passa pela guarda e volta ao início, então esperamos assentar.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement)), { timeout: 2000 }).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de validação ficam associados aos campos (aria-invalid + aria-describedby)', async ({ app, page }) => {
    await app.goto('/')
    await page.locator('header').getByRole('button', { name: 'Entrar' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ')[0].replace(/:/g, '\\:')}`)).toHaveText('Informe um e-mail válido.')
  })

  test('filtros e paginação operáveis só com teclado @mobile', async ({ app, page }) => {
    await app.goto('/mercado')
    const next = page.getByRole('button', { name: 'Próxima página' })
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('#catalogo [role=status]')).toContainText('página 2')
  })
})
