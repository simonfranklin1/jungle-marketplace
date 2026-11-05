import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/types'
import { REALTIME_URL } from '@/api/realtime-config'
import { addEth, compareEth, subEth } from '@/lib/eth'
import { db, nextEventId, persist } from './db'

/**
 * "Servidor" Socket.IO simulado. O cliente usa o socket.io-client real; o MSW intercepta o
 * WebSocket e o binding traduz o protocolo Socket.IO (handshake, pacotes de evento).
 *
 * Eventos:
 *  - nft.updated   -> todos os clientes (dado público)
 *  - order.updated -> somente conexões autenticadas como o dono do pedido
 * Todo evento tem id estável, recurso afetado e versão (para dedupe e descarte de eventos velhos).
 */
type SocketIo = ReturnType<typeof toSocketIo>

interface Conn {
  io: SocketIo
  userId: string | null
  ping: ReturnType<typeof setInterval>
}

const connections = new Set<Conn>()
const recent: Array<NftUpdatedEvent | OrderUpdatedEvent> = []

// o MSW remove o prefixo /socket.io/ da URL do cliente ao casar handlers: o link é só o host
const link = ws.link(REALTIME_URL)

function remember(evt: NftUpdatedEvent | OrderUpdatedEvent) {
  recent.push(evt)
  if (recent.length > 50) recent.shift()
}

function userFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const s = db.sessions.find((x) => x.token === token && x.expiresAt > Date.now())
  return s?.userId ?? null
}

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  const io = toSocketIo(connection)
  const conn: Conn = {
    io,
    userId: null,
    // Engine.IO exige "ping" do servidor; sem isso o cliente cai a cada ~30s
    ping: setInterval(() => connection.client.send('2'), 20_000),
  }
  connections.add(conn)
  startMarketTicker()

  // o cliente se identifica (ou se desidentifica no logout) após conectar
  io.client.on('auth', (_event, token: unknown) => {
    conn.userId = userFromToken(token)
    io.client.emit('auth:result', { authenticated: !!conn.userId })
  })

  connection.client.addEventListener('close', () => {
    clearInterval(conn.ping)
    connections.delete(conn)
  })
})

export function emitNftUpdated(nft: Nft, override?: Partial<NftUpdatedEvent>) {
  const evt: NftUpdatedEvent = {
    id: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      id: nft.id,
      priceEth: nft.priceEth,
      previousPriceEth: nft.previousPriceEth,
      available: nft.available,
      editions: nft.editions.map((e) => ({ ...e })),
      version: nft.version,
    },
    ...override,
  }
  remember(evt)
  persist()
  connections.forEach((c) => c.io.client.emit('nft.updated', evt))
  return evt
}

export function emitOrderUpdated(order: Order) {
  const evt: OrderUpdatedEvent = {
    id: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: { ...order, failureReason: order.failureReason === '__reject__' ? null : order.failureReason },
  }
  remember(evt)
  persist()
  // isolamento por usuário: só quem é dono do pedido recebe
  connections.forEach((c) => {
    if (c.userId === order.userId) c.io.client.emit('order.updated', evt)
  })
  return evt
}

// ---------------- mercado ao vivo ----------------
let ticker: ReturnType<typeof setInterval> | null = null
let tick = 0
const TICK_MS = 30_000

/** A cada 30s um NFT em destaque muda de preço ou de estoque (determinístico, em ciclo). */
function startMarketTicker() {
  if (ticker) return
  ticker = setInterval(() => {
    if (connections.size === 0) return
    tick += 1
    marketMove(tick)
  }, TICK_MS)
}

export function marketMove(n: number, nftId?: string) {
  const pool = db.nfts.slice(0, 9)
  const nft = nftId ? db.nfts.find((x) => x.id === nftId) : pool[n % pool.length]
  if (!nft) return null
  if (n % 2 === 0) {
    const delta = '0.02'
    const up = n % 4 === 0
    const next = up ? addEth(nft.priceEth, delta) : subEth(nft.priceEth, delta)
    if (compareEth(next, '0.05') < 0) return null
    nft.previousPriceEth = up ? null : nft.priceEth
    nft.priceEth = next
  } else {
    const ed = nft.editions.find((e) => e.supply !== null && e.available > 1)
    if (!ed) return null
    ed.available -= 1
    nft.available = nft.editions.reduce((a, e) => a + e.available, 0)
  }
  nft.version += 1
  return emitNftUpdated(nft)
}

// ---------------- ferramentas de QA (usadas pelo painel ?qa=1 e pelos testes E2E) ----------------
export function qaPriceChange(nftId: string) {
  const nft = db.nfts.find((x) => x.id === nftId)
  if (!nft) return null
  nft.previousPriceEth = nft.priceEth
  nft.priceEth = addEth(nft.priceEth, '0.10')
  nft.version += 1
  return emitNftUpdated(nft)
}

export function qaStockChange(nftId: string, editionId: string, available: number) {
  const nft = db.nfts.find((x) => x.id === nftId)
  const ed = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !ed) return null
  ed.available = Math.max(0, available)
  nft.available = nft.editions.reduce((a, e) => a + e.available, 0)
  nft.version += 1
  return emitNftUpdated(nft)
}

/** Reenvia o último evento com o MESMO id (o cliente deve ignorar). */
export function qaDuplicate() {
  const last = recent[recent.length - 1]
  if (!last) return null
  connections.forEach((c) => {
    if (last.type === 'nft.updated') c.io.client.emit('nft.updated', last)
    else if (c.userId === last.data.userId) c.io.client.emit('order.updated', last)
  })
  return last
}

/** Envia um evento com id novo mas versão antiga e preço falso (o cliente deve descartar). */
export function qaStale(nftId: string) {
  const nft = db.nfts.find((x) => x.id === nftId)
  if (!nft) return null
  const evt: NftUpdatedEvent = {
    id: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: Math.max(0, nft.version - 1),
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    data: {
      id: nft.id,
      priceEth: '999.00',
      previousPriceEth: null,
      available: nft.available,
      editions: nft.editions,
      version: Math.max(0, nft.version - 1),
    },
  }
  connections.forEach((c) => c.io.client.emit('nft.updated', evt))
  return evt
}

/** Derruba as conexões (o cliente reconecta sozinho e reconcilia via REST). */
export function qaDisconnect() {
  const n = connections.size
  connections.forEach((c) => {
    clearInterval(c.ping)
    c.io.rawClient.close()
  })
  connections.clear()
  return n
}

export function connectionCount() {
  return connections.size
}
