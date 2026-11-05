import { queryOptions } from '@tanstack/react-query'
import { sessionStore } from '@/features/auth/session-store'
import { api } from './client'
import { meKeys } from './me'
import type { User, Wallet } from './types'

export function profileQuery(uid: string) {
  return queryOptions({
    queryKey: meKeys.profile(uid),
    queryFn: ({ signal }) => api.get<User>('/profile', { signal }).then((r) => r.data),
  })
}

export function walletsQuery(uid: string) {
  return queryOptions({
    queryKey: meKeys.wallets(uid),
    queryFn: ({ signal }) => api.get<Wallet[]>('/wallets', { signal }).then((r) => r.data),
  })
}

/** Mantém o usuário da sessão (header, checkout) em sincronia com o perfil salvo. */
export function syncSessionUser(user: User) {
  const s = sessionStore.get()
  if (s && s.user.id === user.id) sessionStore.set({ ...s, user })
}

export type ProfileInput = Pick<User, 'displayName' | 'username' | 'email' | 'ensName' | 'walletNickname'>

export const updateProfile = (input: ProfileInput) => api.patch<User>('/profile', input).then((r) => r.data)
export const uploadAvatar = (dataUrl: string) => api.put<User>('/profile/avatar', { dataUrl }).then((r) => r.data)
export const removeAvatar = () => api.delete<User>('/profile/avatar').then((r) => r.data)
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/profile/password', { currentPassword, newPassword }).then(() => undefined)

export type WalletInput = Omit<Wallet, 'id'>
export const createWallet = (input: WalletInput) => api.post<Wallet>('/wallets', input).then((r) => r.data)
export const updateWallet = (id: string, input: WalletInput) => api.put<Wallet>(`/wallets/${id}`, input).then((r) => r.data)
