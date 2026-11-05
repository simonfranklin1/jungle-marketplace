import { http, HttpResponse } from 'msw'
import { NETWORKS, type Network, type Wallet, type WalletType } from '@/api/types'
import { hashPassword } from '../data/users'
import { db, persist, uid } from '../db'
import { API, apiError, authenticate, latency } from '../http-utils'
import { passwordIssues, toUser } from './auth'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[a-z0-9_.]{3,20}$/i
const ENS = /^[a-z0-9-]{3,32}$/i
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const WALLET_TYPES: WalletType[] = ['metamask', 'walletconnect', 'coinbase']
const MAX_AVATAR_BYTES = 400 * 1024

export const profileHandlers = [
  http.get(`${API}/profile`, async ({ request }) => {
    await latency(200)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(toUser(db.users.find((u) => u.id === auth.userId)!))
  }),

  http.patch(`${API}/profile`, async ({ request }) => {
    await latency(400)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const user = db.users.find((u) => u.id === auth.userId)!
    const b = (await request.json().catch(() => ({}))) as Record<string, string | undefined>
    const next = {
      displayName: (b.displayName ?? user.displayName).trim(),
      username: (b.username ?? user.username).trim(),
      email: (b.email ?? user.email).trim().toLowerCase(),
      ensName: (b.ensName ?? user.ensName).trim(),
      walletNickname: (b.walletNickname ?? user.walletNickname).trim(),
    }
    const fields: Record<string, string> = {}
    if (next.displayName.length < 2) fields.displayName = 'Informe o nome de exibição.'
    if (!USERNAME.test(next.username)) fields.username = 'Use 3 a 20 letras, números, _ ou .'
    if (!EMAIL.test(next.email)) fields.email = 'Informe um e-mail válido.'
    if (!ENS.test(next.ensName)) fields.ensName = 'Use 3 a 32 letras, números ou hífen.'
    if (next.walletNickname.length < 2) fields.walletNickname = 'Informe o apelido da carteira.'
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Verifique os campos destacados.', { fields })
    if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === next.username.toLowerCase()))
      return apiError('CONFLICT', 'Este nome de usuário já está em uso.', { fields: { username: 'Nome de usuário indisponível.' } })
    if (db.users.some((u) => u.id !== user.id && u.email === next.email))
      return apiError('CONFLICT', 'Este e-mail já está em uso.', { fields: { email: 'E-mail já cadastrado.' } })
    Object.assign(user, next)
    persist()
    return HttpResponse.json(toUser(user))
  }),

  http.put(`${API}/profile/avatar`, async ({ request }) => {
    await latency(500)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const b = (await request.json().catch(() => ({}))) as { dataUrl?: string }
    if (!b.dataUrl || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(b.dataUrl))
      return apiError('VALIDATION', 'Envie uma imagem PNG, JPG, WEBP ou GIF.', { fields: { avatar: 'Formato inválido.' } })
    if (b.dataUrl.length * 0.75 > MAX_AVATAR_BYTES)
      return apiError('VALIDATION', 'A imagem deve ter no máximo 400 KB.', { fields: { avatar: 'Imagem muito grande.' } })
    const user = db.users.find((u) => u.id === auth.userId)!
    user.avatarUrl = b.dataUrl
    persist()
    return HttpResponse.json(toUser(user))
  }),

  http.delete(`${API}/profile/avatar`, async ({ request }) => {
    await latency(300)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const user = db.users.find((u) => u.id === auth.userId)!
    user.avatarUrl = null
    persist()
    return HttpResponse.json(toUser(user))
  }),

  http.post(`${API}/profile/password`, async ({ request }) => {
    await latency(500)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const b = (await request.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string }
    const user = db.users.find((u) => u.id === auth.userId)!
    const fields: Record<string, string> = {}
    if (!b.currentPassword) fields.currentPassword = 'Informe a senha atual.'
    const issue = passwordIssues(b.newPassword ?? '')
    if (issue) fields.newPassword = issue
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Verifique os campos destacados.', { fields })
    if ((await hashPassword(b.currentPassword!, user.passwordSalt)) !== user.passwordHash)
      return apiError('VALIDATION', 'A senha atual está incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    if (b.currentPassword === b.newPassword)
      return apiError('VALIDATION', 'A nova senha deve ser diferente da atual.', { fields: { newPassword: 'Use uma senha diferente da atual.' } })
    user.passwordSalt = crypto.randomUUID()
    user.passwordHash = await hashPassword(b.newPassword!, user.passwordSalt)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------- carteiras ----------------
  http.get(`${API}/wallets`, async ({ request }) => {
    await latency(200)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(db.wallets[auth.userId] ?? [])
  }),

  http.post(`${API}/wallets`, async ({ request }) => {
    await latency(400)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const b = (await request.json().catch(() => ({}))) as Partial<Wallet>
    const list = db.wallets[auth.userId] ?? []
    const res = validateWallet(b, list, null)
    if ('error' in res) return res.error
    const wallet: Wallet = { ...res.wallet, id: uid('wal') }
    db.wallets[auth.userId] = [...list, wallet]
    persist()
    return HttpResponse.json(wallet, { status: 201 })
  }),

  http.put(`${API}/wallets/:id`, async ({ request, params }) => {
    await latency(400)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const list = db.wallets[auth.userId] ?? []
    const current = list.find((w) => w.id === params.id)
    if (!current) {
      const owner = Object.values(db.wallets).some((l) => l.some((w) => w.id === params.id))
      return owner ? apiError('FORBIDDEN', 'Esta carteira pertence a outra conta.') : apiError('NOT_FOUND', 'Carteira não encontrada.')
    }
    const b = (await request.json().catch(() => ({}))) as Partial<Wallet>
    const res = validateWallet({ ...b, kind: current.kind }, list, current.id)
    if ('error' in res) return res.error
    Object.assign(current, res.wallet)
    persist()
    return HttpResponse.json(current)
  }),
]

function validateWallet(
  b: Partial<Wallet>,
  list: Wallet[],
  editingId: string | null,
): { wallet: Omit<Wallet, 'id'> } | { error: ReturnType<typeof apiError> } {
  const w = {
    kind: b.kind === 'secondary' ? 'secondary' : 'primary',
    displayName: (b.displayName ?? '').trim(),
    nickname: (b.nickname ?? '').trim(),
    network: b.network as Network,
    profileName: (b.profileName ?? '').trim(),
    address: (b.address ?? '').trim(),
    secondaryAddress: (b.secondaryAddress ?? '').trim(),
    walletType: b.walletType as WalletType,
    referralCode: (b.referralCode ?? '').trim(),
    email: (b.email ?? '').trim().toLowerCase(),
    ensName: (b.ensName ?? '').trim(),
  } as Omit<Wallet, 'id'>
  const fields: Record<string, string> = {}
  if (w.displayName.length < 2) fields.displayName = 'Informe o nome de exibição.'
  if (w.nickname.length < 2) fields.nickname = 'Informe o apelido da carteira.'
  if (!NETWORKS.some((n) => n.id === w.network)) fields.network = 'Selecione uma rede.'
  if (w.profileName.length < 2) fields.profileName = 'Informe o nome do perfil.'
  if (!ADDRESS.test(w.address)) fields.address = 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
  if (w.secondaryAddress && !ADDRESS.test(w.secondaryAddress) && !/^[a-z0-9-]+\.eth$/i.test(w.secondaryAddress))
    fields.secondaryAddress = 'Use um endereço 0x ou um nome .eth.'
  if (!WALLET_TYPES.includes(w.walletType)) fields.walletType = 'Selecione o tipo de carteira.'
  if (w.referralCode && !/^[A-Z0-9-]{4,16}$/i.test(w.referralCode)) fields.referralCode = 'Código de indicação inválido.'
  if (!EMAIL.test(w.email)) fields.email = 'Informe um e-mail válido.'
  if (!ENS.test(w.ensName)) fields.ensName = 'Use 3 a 32 letras, números ou hífen.'
  if (Object.keys(fields).length) return { error: apiError('VALIDATION', 'Verifique os campos destacados.', { fields }) }
  if (!editingId && list.some((x) => x.kind === w.kind))
    return { error: apiError('CONFLICT', `Você já tem uma carteira ${w.kind === 'primary' ? 'principal' : 'secundária'}.`) }
  if (list.some((x) => x.id !== editingId && x.address.toLowerCase() === w.address.toLowerCase()))
    return {
      error: apiError('CONFLICT', 'Este endereço já está cadastrado em outra carteira.', {
        fields: { address: 'Endereço já cadastrado.' },
      }),
    }
  return { wallet: w }
}
