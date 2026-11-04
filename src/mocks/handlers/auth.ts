import { http, HttpResponse } from 'msw'
import type { Session, User } from '@/api/types'
import { hashPassword } from '../data/users'
import { db, persist, uid, type UserRecord } from '../db'
import { API, apiError, authenticate, latency } from '../http-utils'
import { is } from '../scenario'

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function toUser(u: UserRecord): User {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    username: u.username,
    ensName: u.ensName,
    walletNickname: u.walletNickname,
    avatarUrl: u.avatarUrl,
  }
}

function createSession(user: UserRecord): Session {
  const ttl = is('session-expired') ? 30_000 : SESSION_TTL_MS
  const token = `tok_${crypto.randomUUID().replace(/-/g, '')}`
  const expiresAt = Date.now() + ttl
  db.sessions = db.sessions.filter((s) => s.expiresAt > Date.now())
  db.sessions.push({ token, userId: user.id, expiresAt })
  persist()
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(user) }
}

export function passwordIssues(password: string): string | null {
  if (password.length < 8) return 'A senha precisa ter ao menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.'
  return null
}

export const authHandlers = [
  http.post(`${API}/auth/signup`, async ({ request }) => {
    await latency(400)
    const body = (await request.json().catch(() => ({}))) as { displayName?: string; email?: string; password?: string }
    const displayName = (body.displayName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const fields: Record<string, string> = {}
    if (displayName.length < 2) fields.displayName = 'Informe seu nome (mín. 2 caracteres).'
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.'
    const pw = passwordIssues(password)
    if (pw) fields.password = pw
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Verifique os campos destacados.', { fields })
    if (db.users.some((u) => u.email === email))
      return apiError('CONFLICT', 'Já existe uma conta com este e-mail.', { fields: { email: 'E-mail já cadastrado.' } })

    const salt = crypto.randomUUID()
    const username = email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 20) || 'colecionador'
    const user: UserRecord = {
      id: uid('usr'),
      email,
      displayName,
      username,
      ensName: username,
      walletNickname: 'Carteira principal',
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
    }
    db.users.push(user)
    persist()
    return HttpResponse.json(createSession(user), { status: 201 })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    await latency(400)
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string }
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const fields: Record<string, string> = {}
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.'
    if (!password) fields.password = 'Informe sua senha.'
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Verifique os campos destacados.', { fields })
    const user = db.users.find((u) => u.email === email)
    // mesma mensagem para e-mail inexistente e senha errada (não revela contas)
    if (!user || (await hashPassword(password, user.passwordSalt)) !== user.passwordHash)
      return apiError('UNAUTHORIZED', 'E-mail ou senha incorretos.')
    return HttpResponse.json(createSession(user))
  }),

  http.get(`${API}/auth/session`, async ({ request }) => {
    await latency(150)
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const user = db.users.find((u) => u.id === auth.userId)
    if (!user) return apiError('UNAUTHORIZED', 'Sessão inválida.')
    const session = db.sessions.find((s) => s.userId === user.id && request.headers.get('authorization')?.endsWith(s.token))!
    return HttpResponse.json({
      token: session.token,
      expiresAt: new Date(session.expiresAt).toISOString(),
      user: toUser(user),
    } satisfies Session)
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    await latency(100)
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    db.sessions = db.sessions.filter((s) => s.token !== token)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  /** Ferramenta de QA: força a expiração da sessão atual (usada pelo painel de cenários e E2E). */
  http.post(`${API}/__dev/expire-session`, async ({ request }) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    db.sessions.forEach((s) => {
      if (s.token === token) s.expiresAt = Date.now() - 1
    })
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
