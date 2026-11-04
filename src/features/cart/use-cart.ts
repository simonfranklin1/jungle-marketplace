import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, isApiError } from '@/api/client'
import { meKeys } from '@/api/me'
import type { Cart, CartItem, Network, Quote } from '@/api/types'
import { useUser } from '@/features/auth/session-store'
import { guestCart, useGuestCart } from './guest-cart'

interface CartState {
  items: CartItem[]
  coupon: string | null
}

/**
 * Carrinho unificado: visitante usa localStorage; usuário logado usa o servidor
 * (com atualização otimista e rollback em caso de falha).
 */
export function useCart() {
  const user = useUser()
  const qc = useQueryClient()
  const guest = useGuestCart()

  const serverCart = useQuery({
    queryKey: meKeys.cart(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.get<Cart>('/cart', { signal }).then((r) => r.data),
    enabled: !!user,
    staleTime: 15_000,
  })

  const save = useMutation({
    mutationKey: ['cart-save'],
    // scope serializa as gravações: cliques rápidos chegam ao servidor na ordem certa
    scope: { id: 'cart' },
    mutationFn: (v: { next: CartState; previous?: Cart; uid: string }) => api.put<Cart>('/cart', v.next).then((r) => r.data),
    onError: (e, v) => {
      if (v.previous) qc.setQueryData(meKeys.cart(v.uid), v.previous)
      // sessão expirada já tem aviso próprio (modal de login)
      if (isApiError(e, 'SESSION_EXPIRED') || isApiError(e, 'UNAUTHORIZED')) return
      toast.error('Não foi possível atualizar o carrinho. Tente novamente.')
    },
    onSuccess: (data, v) => {
      // só aplica a resposta do servidor quando não há outra gravação na fila
      if (qc.isMutating({ mutationKey: ['cart-save'] }) <= 1) qc.setQueryData(meKeys.cart(v.uid), data)
    },
  })

  const state: CartState = user
    ? { items: serverCart.data?.items ?? [], coupon: serverCart.data?.coupon ?? null }
    : guest

  const commit = (next: CartState) => {
    if (!user) return guestCart.set(next)
    // atualização otimista imediata; rollback em onError
    const key = meKeys.cart(user.id)
    const previous = qc.getQueryData<Cart>(key)
    void qc.cancelQueries({ queryKey: key })
    qc.setQueryData<Cart>(key, { ...next, updatedAt: new Date().toISOString() })
    save.mutate({ next, previous, uid: user.id })
  }

  return {
    items: state.items,
    coupon: state.coupon,
    count: state.items.reduce((a, i) => a + i.quantity, 0),
    isLoading: !!user && serverCart.isPending,
    isError: !!user && serverCart.isError,
    isSaving: save.isPending,
    /** adiciona respeitando o limite (estoque/máx. por pedido); retorna a quantidade efetiva no carrinho */
    add(item: CartItem, max: number) {
      const existing = state.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, max)
      const items = existing
        ? state.items.map((i) => (i === existing ? { ...i, quantity } : i))
        : [...state.items, { ...item, quantity }]
      commit({ ...state, items })
      return { quantity, capped: (existing?.quantity ?? 0) + item.quantity > max }
    },
    setQuantity(nftId: string, editionId: string, quantity: number) {
      commit({
        ...state,
        items: state.items.map((i) => (i.nftId === nftId && i.editionId === editionId ? { ...i, quantity } : i)),
      })
    },
    remove(nftId: string, editionId: string) {
      commit({ ...state, items: state.items.filter((i) => !(i.nftId === nftId && i.editionId === editionId)) })
    },
    setCoupon(coupon: string | null) {
      commit({ ...state, coupon })
    },
    clear() {
      commit({ items: [], coupon: null })
    },
  }
}

export function useCartCount() {
  return useCart().count
}

export const quoteKey = (items: CartItem[], coupon: string | null, network: Network) =>
  ['quote', { items, coupon, network }] as const

/** Cotação do servidor: preço atual, disponibilidade, cupom, taxa de rede e total. */
export function useQuote(items: CartItem[], coupon: string | null, network: Network = 'ethereum') {
  return useQuery<Quote>({
    queryKey: quoteKey(items, coupon, network),
    queryFn: ({ signal }) => api.post<Quote>('/quote', { items, coupon, network }, { signal }).then((r) => r.data),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}
