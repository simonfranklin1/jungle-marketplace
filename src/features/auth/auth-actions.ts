import { toast } from 'sonner'
import { api, configureAuth } from '@/api/client'
import { meKeys } from '@/api/me'
import { queryClient } from '@/api/query-client'
import type { ApiErrorCode, Cart, Session } from '@/api/types'
import { guestCart } from '@/features/cart/guest-cart'
import { authDialog, sessionStore } from './session-store'

/** Remove do cache tudo o que é privado (carrinho, favoritos, pedidos, perfil, carteiras). */
function clearPrivateCache() {
  queryClient.cancelQueries({ queryKey: meKeys.all })
  queryClient.removeQueries({ queryKey: meKeys.all })
}

async function startSession(session: Session) {
  const previous = sessionStore.get()
  if (previous && previous.user.id !== session.user.id) clearPrivateCache()
  sessionStore.set(session)
  // carrinho de visitante sobrevive ao login: é mesclado ao carrinho da conta
  const guest = guestCart.get()
  if (guest.items.length) {
    try {
      const { data } = await api.post<Cart>('/cart/merge', guest)
      queryClient.setQueryData(meKeys.cart(session.user.id), data)
      guestCart.clear()
      toast.success('Os itens do seu carrinho foram mantidos.')
    } catch {
      toast.error('Não foi possível mesclar o carrinho. Seus itens continuam salvos neste dispositivo.')
    }
  }
}

export async function login(email: string, password: string) {
  const { data } = await api.post<Session>('/auth/login', { email, password })
  await startSession(data)
  return data
}

export async function signup(displayName: string, email: string, password: string) {
  const { data } = await api.post<Session>('/auth/signup', { displayName, email, password })
  await startSession(data)
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } catch {
    /* sessão já inválida no servidor: segue limpando localmente */
  }
  sessionStore.set(null)
  clearPrivateCache()
  guestCart.clear()
  toast.success('Você saiu da sua conta.')
}

let expiredNotified = false
function handleAuthFailure(code: ApiErrorCode, failedToken?: string) {
  const current = sessionStore.get()
  if (!current) return
  // um 401 atrasado de um token antigo (ex.: validação da sessão salva respondendo depois de um
  // novo login) não pode derrubar a sessão atual
  if (failedToken && failedToken !== current.token) return
  sessionStore.set(null)
  clearPrivateCache()
  if (!expiredNotified) {
    expiredNotified = true
    setTimeout(() => (expiredNotified = false), 2000)
    const message = code === 'SESSION_EXPIRED' ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Sua sessão não é mais válida. Entre novamente.'
    toast.warning(message)
    authDialog.open('login', message)
  }
}

/** Liga o Axios à sessão e revalida a sessão salva (recuperação após refresh). */
export function bootstrapAuth() {
  configureAuth(sessionStore.token, handleAuthFailure)
  const saved = sessionStore.get()
  if (saved) {
    api
      .get<Session>('/auth/session')
      // só aplica se a sessão ainda é a mesma que foi validada (o usuário pode ter trocado de conta)
      .then(({ data }) => {
        if (sessionStore.token() === saved.token) sessionStore.set(data)
      })
      .catch(() => {
        /* 401 já tratado pelo interceptor */
      })
  }
  // expiração local: avisa assim que o prazo vence, mesmo sem requisição
  setInterval(() => {
    const s = sessionStore.get()
    if (s && Date.parse(s.expiresAt) <= Date.now()) handleAuthFailure('SESSION_EXPIRED')
  }, 5000)
}

export async function devExpireSession() {
  await api.post('/__dev/expire-session')
}
