import { useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { meKeys } from '@/api/me'
import { nftKeys } from '@/api/nfts'
import { REALTIME_URL } from '@/api/realtime-config'
import type { Cart, Nft, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent, Quote } from '@/api/types'
import { sessionStore } from '@/features/auth/session-store'
import { guestCart } from '@/features/cart/guest-cart'
import { formatEth } from '@/lib/eth'
import { announce } from './announcer'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'

let status: RealtimeStatus = 'connecting'
const statusListeners = new Set<() => void>()
function setStatus(s: RealtimeStatus) {
  status = s
  statusListeners.forEach((l) => l())
}
export function useRealtimeStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => status,
    () => status,
  )
}

/** Ids de eventos já processados (tolerância a duplicatas). Limitado para não crescer sem fim. */
const seen = new Set<string>()
function markSeen(id: string) {
  if (seen.has(id)) return false
  seen.add(id)
  if (seen.size > 500) seen.delete(seen.values().next().value!)
  return true
}

/** Maior versão conhecida por NFT (vinda de REST ou de eventos): eventos com versão menor/igual são velhos. */
const nftVersions = new Map<string, number>()

function knownNftVersion(qc: QueryClient, id: string) {
  let v = nftVersions.get(id) ?? 0
  const detail = qc.getQueryData<Nft>(nftKeys.detail(id))
  if (detail) v = Math.max(v, detail.version)
  for (const [, data] of qc.getQueriesData<NftListResponse>({ queryKey: nftKeys.lists() })) {
    const item = data?.items?.find((i) => i.id === id)
    if (item) v = Math.max(v, item.version)
  }
  return v
}

function findNftName(qc: QueryClient, id: string) {
  const detail = qc.getQueryData<Nft>(nftKeys.detail(id))
  if (detail) return detail.name
  for (const [, data] of qc.getQueriesData<NftListResponse>({ queryKey: nftKeys.lists() })) {
    const item = data?.items?.find((i) => i.id === id)
    if (item) return item.name
  }
  // no carrinho/checkout o nome está nas linhas da cotação
  for (const [, quote] of qc.getQueriesData<Quote>({ queryKey: ['quote'] })) {
    const line = quote?.lines?.find((l) => l.nftId === id)
    if (line) return line.name
  }
  return null
}

function isInCart(qc: QueryClient, id: string) {
  const uid = sessionStore.get()?.user.id
  const items = uid ? (qc.getQueryData<Cart>(meKeys.cart(uid))?.items ?? []) : guestCart.get().items
  return items.some((i) => i.nftId === id)
}

export function handleNftUpdated(qc: QueryClient, evt: NftUpdatedEvent) {
  if (!evt || evt.type !== 'nft.updated' || !evt.data?.id) return 'invalid'
  if (!markSeen(evt.id)) return 'duplicate'
  const id = evt.resource.id
  if (evt.version <= knownNftVersion(qc, id)) return 'stale'
  nftVersions.set(id, evt.version)

  const d = evt.data
  const patch = { priceEth: d.priceEth, previousPriceEth: d.previousPriceEth, available: d.available, version: evt.version }
  const before = qc.getQueryData<Nft>(nftKeys.detail(id))
  qc.setQueryData<Nft>(nftKeys.detail(id), (old) => (old && old.version < evt.version ? { ...old, ...patch, editions: d.editions } : old))
  qc.setQueriesData<NftListResponse>({ queryKey: nftKeys.lists() }, (old) =>
    old?.items ? { ...old, items: old.items.map((i) => (i.id === id && i.version < evt.version ? { ...i, ...patch } : i)) } : old,
  )
  qc.setQueriesData<NftSummary[]>({ queryKey: [...nftKeys.all, 'related'] }, (old) =>
    Array.isArray(old) ? old.map((i) => (i.id === id && i.version < evt.version ? { ...i, ...patch } : i)) : old,
  )
  // cotações (carrinho/checkout) dependem de preço e estoque: o servidor recalcula
  void qc.invalidateQueries({ queryKey: ['quote'] })

  const name = findNftName(qc, id) ?? 'Um NFT'
  const priceChanged = before ? before.priceEth !== d.priceEth : !!d.previousPriceEth
  const msg = priceChanged ? `${name}: preço atualizado para ${formatEth(d.priceEth)}.` : `${name}: disponibilidade atualizada.`
  announce(msg)
  if (isInCart(qc, id)) toast.info(`Item do seu carrinho mudou. ${msg}`)
  return 'applied'
}

export function handleOrderUpdated(qc: QueryClient, evt: OrderUpdatedEvent) {
  if (!evt || evt.type !== 'order.updated' || !evt.data?.id) return 'invalid'
  if (!markSeen(evt.id)) return 'duplicate'
  const uid = sessionStore.get()?.user.id
  // defesa extra contra vazamento: ignora pedido de outro usuário mesmo que chegue
  if (!uid || evt.data.userId !== uid) return 'foreign'
  const key = meKeys.order(uid, evt.resource.id)
  const cached = qc.getQueryData<Order>(key)
  if (cached && cached.version >= evt.version) return 'stale'
  qc.setQueryData<Order>(key, evt.data)
  void qc.invalidateQueries({ queryKey: meKeys.orders(uid), exact: true })
  void qc.invalidateQueries({ queryKey: meKeys.cart(uid) })
  if (cached?.status === 'pending' || !cached) {
    if (evt.data.status === 'confirmed') toast.success('Pedido confirmado na rede! Seus NFTs estão na carteira.')
    if (evt.data.status === 'rejected') toast.error('Pagamento recusado. Os itens voltaram ao carrinho.')
  }
  announce(`Pedido ${evt.data.status === 'confirmed' ? 'confirmado' : evt.data.status === 'rejected' ? 'recusado' : 'atualizado'}.`)
  return 'applied'
}

/** Depois de uma queda, os eventos perdidos são recuperados refazendo as consultas REST. */
function reconcile(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: nftKeys.all })
  void qc.invalidateQueries({ queryKey: ['quote'] })
  const uid = sessionStore.get()?.user.id
  if (uid) {
    void qc.invalidateQueries({ queryKey: meKeys.orders(uid) })
    void qc.invalidateQueries({ queryKey: meKeys.cart(uid) })
  }
}

let socket: Socket | null = null

export async function startRealtime(qc: QueryClient) {
  if (socket) return socket
  // import tardio: o engine.io-client guarda a classe WebSocket global no momento do import;
  // carregá-lo depois do MSW garante que ele use o WebSocket interceptado.
  const { io } = await import('socket.io-client')
  if (socket) return socket
  socket = io(REALTIME_URL, {
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  let wasDisconnected = false
  const s = socket
  // exposto para depuração e para os testes E2E (somente leitura do estado da conexão)
  ;(window as unknown as { __kurioSocket?: Socket }).__kurioSocket = s

  s.on('connect', () => {
    setStatus('connected')
    s.emit('auth', sessionStore.token())
    if (wasDisconnected) {
      reconcile(qc)
      announce('Conexão em tempo real restabelecida.')
    }
    wasDisconnected = false
  })
  s.on('disconnect', () => {
    wasDisconnected = true
    setStatus('reconnecting')
  })
  s.on('connect_error', () => setStatus('reconnecting'))
  s.on('nft.updated', (evt: NftUpdatedEvent) => handleNftUpdated(qc, evt))
  s.on('order.updated', (evt: OrderUpdatedEvent) => handleOrderUpdated(qc, evt))

  // login/logout/troca de usuário: reidentifica a conexão (o servidor filtra eventos privados)
  let lastToken = sessionStore.token()
  sessionStore.subscribe(() => {
    const token = sessionStore.token()
    if (token === lastToken) return
    lastToken = token
    if (s.connected) s.emit('auth', token)
  })
  return s
}
