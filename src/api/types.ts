// Contratos REST compartilhados entre o app e o mock server (MSW).

export const CATEGORIES = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
] as const
export type Category = (typeof CATEGORIES)[number]['id']

export const NETWORKS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
] as const
export type Network = (typeof NETWORKS)[number]['id']

export const SORTS = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome (A-Z)' },
] as const
export type SortId = (typeof SORTS)[number]['id']

export const TABS = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const
export type TabId = (typeof TABS)[number]['id']

export interface Edition {
  id: string
  label: string
  /** null = edição aberta */
  supply: number | null
  available: number
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  image: string
  thumb: string
  priceEth: string
  previousPriceEth: string | null
  rarity: 'raro' | null
  category: Category
  network: Network
  available: number
  version: number
}

export interface Nft extends NftSummary {
  collection: string
  description: string
  details: string
  attributes: string[]
  editions: Edition[]
  rating: number
  reviewsCount: number
  contract: string
  royaltiesPercent: number
  maxPerOrder: number
  createdAt: string
}

export interface NftListQuery {
  q?: string
  category?: Category
  network?: Network
  priceMin?: string
  priceMax?: string
  tab?: TabId
  sort?: SortId
  page?: number
  pageSize?: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    categories: Record<Category, number>
    networks: Record<Network, number>
    priceRange: { min: string; max: string }
  }
}

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'PRICE_CHANGED'
  | 'COUPON_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'TRANSIENT'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    fields?: Record<string, string>
    details?: unknown
  }
}

// ---- Sessão / conta ----
export interface User {
  id: string
  email: string
  displayName: string
  username: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

// ---- Carrinho / cotação ----
export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
}

export interface Cart {
  items: CartItem[]
  coupon: string | null
  updatedAt: string
}

export type QuoteIssue =
  | { type: 'PRICE_CHANGED'; nftId: string; previous: string; current: string }
  | { type: 'UNAVAILABLE'; nftId: string; editionId: string; available: number }
  | { type: 'NOT_FOUND'; nftId: string }

export interface QuoteLine {
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  thumb: string
  unitPriceEth: string
  quantity: number
  lineTotalEth: string
  available: number
}

export interface Quote {
  lines: QuoteLine[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  coupon: { code: string; percent: number } | null
  couponError: string | null
  issues: QuoteIssue[]
  network: Network
}

// ---- Pedidos ----
export type OrderStatus = 'pending' | 'confirmed' | 'rejected'
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase'

export interface OrderReceipt {
  lines: QuoteLine[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  coupon: string | null
  network: Network
  walletType: WalletType
  walletAddress: string
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  txHash: string | null
  createdAt: string
  updatedAt: string
  version: number
  failureReason: string | null
  receipt: OrderReceipt
}

// ---- Carteiras ----
export interface Wallet {
  id: string
  kind: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string
  walletType: WalletType
  referralCode: string
  email: string
  ensName: string
}

// ---- Eventos em tempo real ----
export interface RealtimeEvent<T extends string, P> {
  id: string
  type: T
  resource: { type: 'nft' | 'order'; id: string }
  version: number
  occurredAt: string
  data: P
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft.updated',
  Pick<Nft, 'id' | 'priceEth' | 'previousPriceEth' | 'available' | 'editions' | 'version'>
>
export type OrderUpdatedEvent = RealtimeEvent<'order.updated', Order>
