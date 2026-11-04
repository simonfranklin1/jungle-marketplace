import { queryOptions } from '@tanstack/react-query'
import { api } from './client'
import { meKeys } from './me'
import type { CartItem, Network, Order, WalletType } from './types'

export interface CreateOrderPayload {
  items: CartItem[]
  coupon: string | null
  network: Network
  walletType: WalletType
  walletAddress: string
  expectedTotalEth: string
  buyer: Record<string, string>
}

export function createOrder(payload: CreateOrderPayload, idempotencyKey: string) {
  return api
    .post<Order>('/orders', payload, { headers: { 'Idempotency-Key': idempotencyKey } })
    .then((r) => r.data)
}

export function connectWallet(walletType: WalletType, network: Network) {
  return api
    .post<{ walletType: WalletType; address: string; network: Network }>('/wallet/connect', { walletType, network })
    .then((r) => r.data)
}

export function orderQuery(uid: string, id: string) {
  return queryOptions({
    queryKey: meKeys.order(uid, id),
    queryFn: ({ signal }) => api.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
    // enquanto pendente, consulta periodicamente (fallback caso o evento em tempo real se perca)
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false),
  })
}

export function ordersQuery(uid: string) {
  return queryOptions({
    queryKey: meKeys.orders(uid),
    queryFn: ({ signal }) => api.get<Order[]>('/orders', { signal }).then((r) => r.data),
  })
}
