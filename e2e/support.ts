import { expect, test as base, type Page } from '@playwright/test'

/**
 * Cada teste roda num contexto novo do navegador: localStorage, Service Worker (MSW) e o
 * "banco" do mock começam do zero (estado isolado). O ticker do mercado é desligado para que
 * preços só mudem quando o teste dispara um evento pelo servidor simulado.
 */
export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kurio:ticker', 'off')
      } catch {
        /* ignore */
      }
    })
    await use(new App(page))
  },
})
export { expect }

export const DEMO = { email: 'demo@kurio.test', password: 'Kurio@123', name: 'Colecionador Demo' }
export const ANA = { email: 'ana@kurio.test', password: 'Kurio@123', name: 'Ana Colecionadora' }

export class App {
  constructor(readonly page: Page) {}

  /** Abre uma rota e espera o MSW + app estarem prontos. */
  async goto(path = '/', opts: { scenario?: string } = {}) {
    const url = new URL(path, 'http://x')
    if (opts.scenario) url.searchParams.set('scenario', opts.scenario)
    await this.page.goto(url.pathname + url.search)
    await expect(this.page.locator('#conteudo')).toBeVisible()
  }

  /** Troca o cenário do backend simulado (via ferramenta de QA do mock, sem recarregar). */
  async scenario(name: string) {
    await this.api('/api/__dev/scenario', { scenario: name })
  }

  async api<T = unknown>(path: string, body?: unknown, method = 'POST', token?: string): Promise<{ status: number; data: T }> {
    return this.page.evaluate(
      async ({ path, body, method, token }) => {
        const res = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await res.text()
        return { status: res.status, data: text ? JSON.parse(text) : null }
      },
      { path, body, method, token },
    )
  }

  /** Dispara um evento no servidor Socket.IO simulado (chega ao app pelo socket.io-client real). */
  async realtime(action: string, extra: Record<string, unknown> = {}) {
    return this.api<{ event?: { id: string } }>('/api/__dev/realtime', { action, ...extra })
  }

  async waitRealtime() {
    await expect(this.page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
  }

  /** Login pela interface (modal). No mobile o modal é aberto pela rota protegida /perfil. */
  async loginUI(user = DEMO) {
    const desktop = (this.page.viewportSize()?.width ?? 1440) >= 768
    if (desktop) await this.page.locator('header').getByRole('button', { name: 'Entrar' }).click()
    else await this.page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link', { name: 'Meu perfil' }).click()
    const dialog = this.page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(user.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(user.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  /** Login direto pela API (atalho para testes que não validam o fluxo de login). */
  async loginAPI(user = DEMO) {
    const { data } = await this.api<{ token: string }>('/api/auth/login', { email: user.email, password: user.password })
    await this.page.evaluate((s) => localStorage.setItem('kurio:session', JSON.stringify(s)), data)
    await this.page.reload()
    await expect(this.page.locator('#conteudo')).toBeVisible()
    return data.token
  }

  async token() {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('kurio:session') ?? 'null')?.token as string | undefined)
  }

  /** Coloca itens no carrinho da conta pelo endpoint REST (pré-condição de testes). */
  async seedCart(items: Array<{ nftId: string; editionId: string; quantity: number }>, coupon: string | null = null) {
    const token = await this.token()
    await this.api('/api/cart', { items, coupon }, 'PUT', token)
  }

  toast(text: string | RegExp) {
    return this.page.locator('[data-sonner-toast]').filter({ hasText: text })
  }
}

/** Preenche o checkout (dados já vêm do perfil) e conecta a carteira cadastrada. */
export async function connectWalletAtCheckout(page: Page, wallet = 'MetaMask') {
  await page.getByRole('radio', { name: new RegExp(wallet) }).check()
  await page.getByRole('button', { name: /Conectar carteira|Tentar conectar/ }).click()
  await expect(page.getByText(/Conectada:/)).toBeVisible()
}
