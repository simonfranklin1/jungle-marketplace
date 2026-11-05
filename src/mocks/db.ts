import type { Cart, Order, User, Wallet } from '@/api/types'
import { buildCatalog, type NftRecord } from './data/seed'
import { SEED_USERS, SEED_WALLETS } from './data/users'

/**
 * "Banco" do mock server. Vive no browser junto com o MSW e é persistido em
 * localStorage para sobreviver a refresh (o backend simulado não "reinicia" a cada F5).
 * Nunca é acessado pela UI: só pelos handlers MSW.
 */
export interface UserRecord extends User {
  passwordHash: string
  passwordSalt: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

export interface IdempotencyRecord {
  userId: string
  fingerprint: string
  orderId: string
}

export interface DbState {
  schema: number
  nfts: NftRecord[]
  users: UserRecord[]
  sessions: SessionRecord[]
  carts: Record<string, Cart>
  favorites: Record<string, string[]>
  orders: Order[]
  idempotency: Record<string, IdempotencyRecord>
  wallets: Record<string, Wallet[]>
  eventSeq: number
}

const KEY = 'kurio:mockdb'
const SCHEMA = 3

function fresh(): DbState {
  return {
    schema: SCHEMA,
    nfts: buildCatalog(),
    users: SEED_USERS.map((u) => ({ ...u })),
    sessions: [],
    carts: {},
    favorites: {},
    orders: [],
    idempotency: {},
    wallets: structuredClone(SEED_WALLETS),
    eventSeq: 0,
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA) return parsed
    }
  } catch {
    /* storage indisponível: segue em memória */
  }
  return fresh()
}

export let db: DbState = load()

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

export function resetDb() {
  db = fresh()
  persist()
}

export function findNft(id: string) {
  return db.nfts.find((n) => n.id === id)
}

export function nextEventId() {
  db.eventSeq += 1
  return `evt_${Date.now().toString(36)}_${db.eventSeq}`
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}
