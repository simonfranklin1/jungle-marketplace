/**
 * Cenários determinísticos do mock. Ative via URL (?scenario=nome) ou pelo painel de
 * cenários (rodapé). O valor fica salvo em localStorage até ser trocado.
 */
export const SCENARIOS = {
  default: 'Padrão (latência curta, tudo funciona)',
  slow: 'Latência alta (2.5s) em todas as requisições',
  'variable-latency': 'Latência variável determinística (respostas podem chegar fora de ordem)',
  offline: 'Sem conexão: toda requisição falha com erro de rede',
  'empty-catalog': 'Catálogo sem resultados',
  'favorites-error': 'Falha ao salvar favoritos (testa rollback otimista)',
  'catalog-error': 'Falha transitória (503) na listagem de NFTs',
  'flaky': 'Primeira tentativa de cada GET falha com 503',
  timeout: 'Requisições de catálogo excedem o timeout',
  'session-expired': 'Sessão expira 30s após o login',
  'coupon-error': 'Serviço de cupom indisponível',
  'price-change': 'Preço muda ao confirmar o pedido',
  'stock-conflict': 'Estoque acaba ao confirmar o pedido',
  'order-timeout': 'Pedido é criado mas a resposta expira (timeout)',
  'payment-rejected': 'Pagamento rejeitado após processamento',
  'wallet-rejected': 'Usuário rejeita a conexão da carteira',
  'wallet-disconnect': 'Carteira desconecta durante a confirmação',
} as const

export type ScenarioId = keyof typeof SCENARIOS
const KEY = 'kurio:scenario'

export function getScenario(): ScenarioId {
  try {
    const v = localStorage.getItem(KEY)
    if (v && v in SCENARIOS) return v as ScenarioId
  } catch {
    /* ignore */
  }
  return 'default'
}

export function setScenario(id: ScenarioId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
}

export function is(id: ScenarioId) {
  return getScenario() === id
}

/** Lê ?scenario= e ?reset=1 na inicialização. */
export function applyScenarioFromUrl(): { reset: boolean } {
  const url = new URL(window.location.href)
  const s = url.searchParams.get('scenario')
  const reset = url.searchParams.get('reset') === '1'
  if (s && s in SCENARIOS) setScenario(s as ScenarioId)
  if (s || reset) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('reset')
    window.history.replaceState(null, '', url.toString())
  }
  return { reset }
}
