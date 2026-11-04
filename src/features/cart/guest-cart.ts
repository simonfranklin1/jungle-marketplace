import { useSyncExternalStore } from 'react'
import type { CartItem } from '@/api/types'

/** Carrinho de visitante (sem login): vive em localStorage e é mesclado ao da conta no login. */
const KEY = 'kurio:guest-cart'
export interface GuestCart {
  items: CartItem[]
  coupon: string | null
}
const EMPTY: GuestCart = { items: [], coupon: null }

function read(): GuestCart {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as GuestCart
    if (!Array.isArray(parsed.items)) return EMPTY
    return {
      items: parsed.items.filter((i) => i && typeof i.nftId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0),
      coupon: typeof parsed.coupon === 'string' ? parsed.coupon : null,
    }
  } catch {
    return EMPTY
  }
}

let state = read()
const listeners = new Set<() => void>()

export const guestCart = {
  get: () => state,
  set(next: GuestCart) {
    state = next
    try {
      if (next.items.length || next.coupon) localStorage.setItem(KEY, JSON.stringify(next))
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  },
  clear() {
    guestCart.set(EMPTY)
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = read()
    listeners.forEach((l) => l())
  })
}

export function useGuestCart() {
  return useSyncExternalStore(guestCart.subscribe, guestCart.get, guestCart.get)
}
