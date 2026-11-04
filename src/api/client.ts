import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './types'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fields?: Record<string, string>
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, status: number, fields?: Record<string, string>, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.fields = fields
    this.details = details
  }

  get isTransient() {
    return this.code === 'TRANSIENT'
  }
}

type TokenGetter = () => string | null
type ExpiredHandler = (code: ApiErrorCode) => void

let getToken: TokenGetter = () => null
let onAuthFailure: ExpiredHandler = () => {}

/** O módulo de sessão registra como obter o token e como reagir a 401. */
export function configureAuth(getter: TokenGetter, handler: ExpiredHandler) {
  getToken = getter
  onAuthFailure = handler
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) throw error
    const status = error.response?.status ?? 0
    const body = error.response?.data?.error
    let apiError: ApiError
    if (body) {
      apiError = new ApiError(body.code, body.message, status, body.fields, body.details)
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      apiError = new ApiError('TRANSIENT', 'A requisição demorou demais. Tente novamente.', 0)
    } else {
      apiError = new ApiError('TRANSIENT', 'Falha de conexão. Verifique sua rede e tente novamente.', status)
    }
    const sentToken = error.config?.headers?.Authorization
    if ((apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHORIZED') && sentToken) {
      onAuthFailure(apiError.code)
    }
    throw apiError
  },
)

export function isApiError(e: unknown, code?: ApiErrorCode): e is ApiError {
  return e instanceof ApiError && (!code || e.code === code)
}
