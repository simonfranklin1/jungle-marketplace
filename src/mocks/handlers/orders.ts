import { delay, http, HttpResponse } from 'msw'
import { NETWORKS, type Network, type Order, type WalletType } from '@/api/types'
import { addEth, compareEth } from '@/lib/eth'
import { db, findNft, persist, uid } from '../db'
import { API, apiError, authenticate, latency } from '../http-utils'
import { computeQuote, normalizeItems } from '../quote'
import { emitNftUpdated, emitOrderUpdated } from '../realtime'
import { is } from '../scenario'

const WALLET_TYPES: WalletType[] = ['metamask', 'walletconnect', 'coinbase']
const PROCESSING_MS = 3000
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const priceBumped = new Set<string>()

function randomHex(len: number) {
  return [...crypto.getRandomValues(new Uint8Array(len / 2))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fingerprint(body: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(body))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Liquida um pedido pendente: confirma (baixa estoque) ou rejeita (devolve itens ao carrinho).
 * Chamado por timer e também de forma preguiçosa no GET, para sobreviver a refresh da página.
 */
export function settleOrder(order: Order) {
  if (order.status !== 'pending') return
  if (Date.now() - Date.parse(order.createdAt) < PROCESSING_MS) return
  const rejected = order.failureReason === '__reject__'
  const now = new Date().toISOString()
  if (rejected) {
    order.status = 'rejected'
    order.failureReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.'
    const cart = db.carts[order.userId] ?? { items: [], coupon: null, updatedAt: now }
    const items = normalizeItems([
      ...cart.items,
      ...order.receipt.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
    ])!
    db.carts[order.userId] = { items, coupon: order.receipt.coupon, updatedAt: now }
  } else {
    order.status = 'confirmed'
    order.failureReason = null
    order.txHash = `0x${randomHex(64)}`
    for (const line of order.receipt.lines) {
      const nft = findNft(line.nftId)
      const edition = nft?.editions.find((e) => e.id === line.editionId)
      if (!nft || !edition) continue
      if (edition.supply !== null) edition.available = Math.max(0, edition.available - line.quantity)
      nft.available = nft.editions.reduce((a, e) => a + e.available, 0)
      nft.version += 1
      emitNftUpdated(nft)
    }
  }
  order.updatedAt = now
  order.version += 1
  persist()
  emitOrderUpdated(order)
}

export function scheduleSettle(orderId: string) {
  setTimeout(() => {
    const order = db.orders.find((o) => o.id === orderId)
    if (order) settleOrder(order)
  }, PROCESSING_MS + 50)
}

export const orderHandlers = [
  /** Simula a conexão com a extensão da carteira (aprovação/rejeição pelo usuário). */
  http.post(`${API}/wallet/connect`, async ({ request }) => {
    await latency(900)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = (await request.json().catch(() => null)) as { walletType?: string; network?: string } | null
    if (!WALLET_TYPES.includes(body?.walletType as WalletType))
      return apiError('VALIDATION', 'Selecione uma carteira compatível.')
    if (is('wallet-rejected')) return apiError('FORBIDDEN', 'Você recusou a conexão na carteira.', { details: { reason: 'WALLET_REJECTED' } })
    return HttpResponse.json({ walletType: body!.walletType, address: `0x${randomHex(40)}`, network: body!.network ?? 'ethereum' })
  }),

  http.post(`${API}/orders`, async ({ request }) => {
    await latency(500)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) return apiError('VALIDATION', 'Cabeçalho Idempotency-Key obrigatório.')

    const body = (await request.json().catch(() => null)) as {
      items?: unknown
      coupon?: string | null
      network?: Network
      walletType?: WalletType
      walletAddress?: string
      expectedTotalEth?: string
      buyer?: Record<string, string>
    } | null
    const fp = await fingerprint(body)
    const previous = db.idempotency[key]
    if (previous) {
      if (previous.userId !== auth.userId || previous.fingerprint !== fp)
        return apiError('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      const existing = db.orders.find((o) => o.id === previous.orderId)!
      settleOrder(existing)
      return HttpResponse.json(existing, { status: 200 })
    }

    const items = normalizeItems(body?.items)
    const fields: Record<string, string> = {}
    if (!items || items.length === 0) fields.items = 'Carrinho vazio.'
    if (!NETWORKS.some((n) => n.id === body?.network)) fields.network = 'Selecione uma rede.'
    if (!WALLET_TYPES.includes(body?.walletType as WalletType)) fields.walletType = 'Selecione uma carteira.'
    if (!ADDRESS.test(body?.walletAddress ?? '')) fields.walletAddress = 'Carteira não conectada.'
    if (!body?.expectedTotalEth) fields.expectedTotalEth = 'Total esperado ausente.'
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Dados do pedido inválidos.', { fields })

    if (is('wallet-disconnect'))
      return apiError('CONFLICT', 'A carteira foi desconectada. Conecte novamente para continuar.', { details: { reason: 'WALLET_DISCONNECTED' } })

    // cenários de concorrência: o catálogo muda entre a cotação e a confirmação
    const first = findNft(items![0].nftId)
    // muda o preço uma única vez por NFT: a nova tentativa (com o total revisado) passa
    if (first && is('price-change') && !priceBumped.has(first.id)) {
      priceBumped.add(first.id)
      first.previousPriceEth = first.priceEth
      first.priceEth = addEth(first.priceEth, '0.05')
      first.version += 1
      persist()
      emitNftUpdated(first)
    }
    if (first && is('stock-conflict')) {
      const ed = first.editions.find((e) => e.id === items![0].editionId)
      if (ed && ed.available > 0) {
        ed.available = 0
        first.available = first.editions.reduce((a, e) => a + e.available, 0)
        first.version += 1
        persist()
        emitNftUpdated(first)
      }
    }

    // revalidação completa no servidor: preço, estoque, cupom e taxa
    const quote = computeQuote(items!, body!.coupon ?? null, body!.network)
    if (quote.issues.length) return apiError('UNAVAILABLE', 'Alguns itens não estão mais disponíveis.', { details: { quote } })
    if (body!.coupon && !quote.coupon) return apiError('COUPON_INVALID', quote.couponError ?? 'Cupom inválido.', { details: { quote } })
    if (compareEth(quote.totalEth, body!.expectedTotalEth!) !== 0)
      return apiError('PRICE_CHANGED', 'Os valores mudaram desde a última cotação. Revise o novo total.', { details: { quote } })

    const now = new Date().toISOString()
    const order: Order = {
      id: uid('ord'),
      userId: auth.userId,
      status: 'pending',
      txHash: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      failureReason: is('payment-rejected') ? '__reject__' : null,
      receipt: {
        lines: quote.lines,
        subtotalEth: quote.subtotalEth,
        discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth,
        totalEth: quote.totalEth,
        coupon: quote.coupon?.code ?? null,
        network: quote.network,
        walletType: body!.walletType!,
        walletAddress: body!.walletAddress!,
      },
    }
    db.orders.push(order)
    db.idempotency[key] = { userId: auth.userId, fingerprint: fp, orderId: order.id }
    db.carts[auth.userId] = { items: [], coupon: null, updatedAt: now }
    persist()
    scheduleSettle(order.id)

    // pedido criado, mas a resposta "se perde": o cliente deve repetir com a mesma chave
    if (is('order-timeout')) await delay(12000)
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),

  http.get(`${API}/orders`, async ({ request }) => {
    await latency(200)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const mine = db.orders.filter((o) => o.userId === auth.userId)
    mine.forEach(settleOrder)
    return HttpResponse.json(mine.map(publicOrder).reverse())
  }),

  http.get(`${API}/orders/:id`, async ({ request, params }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const order = db.orders.find((o) => o.id === params.id)
    if (!order) return apiError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== auth.userId) return apiError('FORBIDDEN', 'Este pedido pertence a outra conta.')
    settleOrder(order)
    return HttpResponse.json(publicOrder(order))
  }),
]

export function publicOrder(o: Order): Order {
  return { ...o, failureReason: o.failureReason === '__reject__' ? null : o.failureReason }
}
