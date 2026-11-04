import { http, HttpResponse } from 'msw'
import { NETWORKS, type Cart, type CartItem, type Network } from '@/api/types'
import { db, findNft, persist } from '../db'
import { API, apiError, authenticate, latency } from '../http-utils'
import { checkCoupon, computeQuote, normalizeItems } from '../quote'

function emptyCart(): Cart {
  return { items: [], coupon: null, updatedAt: new Date().toISOString() }
}

function capItems(items: CartItem[]): CartItem[] {
  return items
    .filter((i) => findNft(i.nftId))
    .map((i) => ({ ...i, quantity: Math.min(i.quantity, findNft(i.nftId)!.maxPerOrder) }))
}

export const cartHandlers = [
  http.get(`${API}/cart`, async ({ request }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(db.carts[auth.userId] ?? emptyCart())
  }),

  http.put(`${API}/cart`, async ({ request }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = (await request.json().catch(() => null)) as { items?: unknown; coupon?: unknown } | null
    const items = normalizeItems(body?.items)
    if (!items) return apiError('VALIDATION', 'Itens do carrinho inválidos.')
    const coupon = typeof body?.coupon === 'string' && body.coupon ? body.coupon.toUpperCase() : null
    const cart: Cart = { items: capItems(items), coupon, updatedAt: new Date().toISOString() }
    db.carts[auth.userId] = cart
    persist()
    return HttpResponse.json(cart)
  }),

  /** Junta o carrinho de visitante ao carrinho da conta após o login. */
  http.post(`${API}/cart/merge`, async ({ request }) => {
    await latency(200)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = (await request.json().catch(() => null)) as { items?: unknown; coupon?: unknown } | null
    const guest = normalizeItems(body?.items)
    if (!guest) return apiError('VALIDATION', 'Itens do carrinho inválidos.')
    const current = db.carts[auth.userId] ?? emptyCart()
    const merged = normalizeItems([...current.items, ...guest])!
    const coupon = current.coupon ?? (typeof body?.coupon === 'string' && body.coupon ? body.coupon : null)
    const cart: Cart = { items: capItems(merged), coupon, updatedAt: new Date().toISOString() }
    db.carts[auth.userId] = cart
    persist()
    return HttpResponse.json(cart)
  }),

  /** Cotação: preço, disponibilidade, cupom, taxa de rede e total. Pública (visitante também cota). */
  http.post(`${API}/quote`, async ({ request }) => {
    await latency(200)
    const body = (await request.json().catch(() => null)) as { items?: unknown; coupon?: unknown; network?: unknown } | null
    const items = normalizeItems(body?.items)
    if (!items) return apiError('VALIDATION', 'Itens inválidos para cotação.')
    const network = (NETWORKS.some((n) => n.id === body?.network) ? body?.network : 'ethereum') as Network
    const coupon = typeof body?.coupon === 'string' && body.coupon ? body.coupon : null
    return HttpResponse.json(computeQuote(items, coupon, network))
  }),

  http.post(`${API}/coupons/validate`, async ({ request }) => {
    await latency(300)
    const body = (await request.json().catch(() => null)) as { code?: unknown; items?: unknown } | null
    const items = normalizeItems(body?.items ?? [])
    if (typeof body?.code !== 'string' || !body.code.trim() || !items)
      return apiError('VALIDATION', 'Informe um código promocional.', { fields: { code: 'Informe um código.' } })
    const quote = computeQuote(items, null)
    const check = checkCoupon(body.code, quote.subtotalEth)
    if (!check.ok)
      return check.transient
        ? apiError('TRANSIENT', check.message)
        : apiError('COUPON_INVALID', check.message, { fields: { code: check.message } })
    return HttpResponse.json({ code: check.code, percent: check.percent })
  }),

  http.get(`${API}/favorites`, async ({ request }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(db.favorites[auth.userId] ?? [])
  }),

  http.put(`${API}/favorites/:nftId`, async ({ request, params }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const id = String(params.nftId)
    if (!findNft(id)) return apiError('NOT_FOUND', 'NFT não encontrado.')
    const list = new Set(db.favorites[auth.userId] ?? [])
    list.add(id)
    db.favorites[auth.userId] = [...list]
    persist()
    return HttpResponse.json(db.favorites[auth.userId])
  }),

  http.delete(`${API}/favorites/:nftId`, async ({ request, params }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    db.favorites[auth.userId] = (db.favorites[auth.userId] ?? []).filter((x) => x !== String(params.nftId))
    persist()
    return HttpResponse.json(db.favorites[auth.userId])
  }),
]
