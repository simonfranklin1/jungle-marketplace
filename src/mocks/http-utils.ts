import { delay, HttpResponse } from 'msw'
import type { ApiErrorCode } from '@/api/types'
import { db, reloadDb } from './db'
import { getScenario, is } from './scenario'

export const API = '/api'

export async function latency(base = 250) {
  await delay(is('slow') ? 2500 : base)
}

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAVAILABLE: 409,
  PRICE_CHANGED: 409,
  COUPON_INVALID: 422,
  IDEMPOTENCY_CONFLICT: 409,
  TRANSIENT: 503,
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  extra?: { fields?: Record<string, string>; details?: unknown },
) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status: STATUS[code] })
}

/** Cenário "flaky": a primeira chamada de cada rota GET falha. */
const flakySeen = new Set<string>()
export function flaky(key: string) {
  if (getScenario() !== 'flaky') return null
  if (flakySeen.has(key)) return null
  flakySeen.add(key)
  return apiError('TRANSIENT', 'Instabilidade temporária. Tente novamente.')
}

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: ReturnType<typeof apiError> }

export function authenticate(request: Request): AuthResult {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { ok: false, response: apiError('UNAUTHORIZED', 'Entre para continuar.') }
  let session = db.sessions.find((s) => s.token === token)
  // sessão criada em outra aba e ainda não sincronizada: relê o banco antes de recusar
  if (!session) {
    reloadDb()
    session = db.sessions.find((s) => s.token === token)
  }
  if (!session) return { ok: false, response: apiError('UNAUTHORIZED', 'Sessão inválida.') }
  if (session.expiresAt < Date.now())
    return { ok: false, response: apiError('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  return { ok: true, userId: session.userId }
}
