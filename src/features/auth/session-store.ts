import { useSyncExternalStore } from 'react'
import type { Session } from '@/api/types'

/**
 * Sessão do usuário. Guardamos só token + dados públicos do usuário (nunca senha).
 * Persistida em localStorage para recuperar a sessão após refresh; o token é revalidado
 * no servidor na inicialização (GET /auth/session).
 */
const KEY = 'kurio:session'
type Listener = () => void

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (Date.parse(s.expiresAt) <= Date.now()) {
      localStorage.removeItem(KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

let current: Session | null = read()
const listeners = new Set<Listener>()

export const sessionStore = {
  get: () => current,
  token: () => current?.token ?? null,
  set(session: Session | null) {
    current = session
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session))
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

// Sessões em outra aba (login/logout) refletem aqui também.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    current = read()
    listeners.forEach((l) => l())
  })
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export function useUser() {
  return useSession()?.user ?? null
}

// ---- Modal de autenticação (aberto por qualquer parte do app, inclusive interceptors) ----
export type AuthMode = 'login' | 'signup'
interface AuthDialogState {
  open: boolean
  mode: AuthMode
  reason: string | null
}
let dialog: AuthDialogState = { open: false, mode: 'login', reason: null }
const dialogListeners = new Set<Listener>()
let afterAuth: (() => void) | null = null

export const authDialog = {
  get: () => dialog,
  open(mode: AuthMode = 'login', reason: string | null = null, onSuccess?: () => void) {
    dialog = { open: true, mode, reason }
    afterAuth = onSuccess ?? null
    dialogListeners.forEach((l) => l())
  },
  close() {
    dialog = { ...dialog, open: false }
    dialogListeners.forEach((l) => l())
  },
  setMode(mode: AuthMode) {
    dialog = { ...dialog, mode }
    dialogListeners.forEach((l) => l())
  },
  /** chamado após login/cadastro bem-sucedido */
  consumeAfterAuth() {
    const fn = afterAuth
    afterAuth = null
    return fn
  },
  subscribe(l: Listener) {
    dialogListeners.add(l)
    return () => dialogListeners.delete(l)
  },
}

export function useAuthDialog() {
  return useSyncExternalStore(authDialog.subscribe, authDialog.get, authDialog.get)
}
