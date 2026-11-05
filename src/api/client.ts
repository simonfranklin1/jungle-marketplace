import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
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
/** recebe o token que falhou, para não derrubar uma sessão mais nova (ex.: login durante a validação) */
type ExpiredHandler = (code: ApiErrorCode, failedToken: string) => void

let getToken: TokenGetter = () => null
let onAuthFailure: ExpiredHandler = () => {}

/** O módulo de sessão registra como obter o token e como reagir a 401. */
export function configureAuth(getter: TokenGetter, handler: ExpiredHandler) {
  getToken = getter
  onAuthFailure = handler
}

/**
 * O MSW roda num Service Worker que o navegador pode encerrar quando ocioso; ao religar, ele
 * esquece quais abas estão ativas e deixa a requisição passar para o servidor estático
 * (que responde HTML). Detectamos isso, reativamos o mock e repetimos a requisição uma vez.
 */
let recoverMocks: (() => Promise<void>) | null = null
let recovering: Promise<void> | null = null
export function configureMockRecovery(fn: () => Promise<void>) {
  recoverMocks = fn
}

type RetriableConfig = InternalAxiosRequestConfig & { _mockRetry?: boolean }

function isNotJson(res?: AxiosResponse) {
  if (!res || res.status === 204) return false
  const ct = String(res.headers['content-type'] ?? '')
  return !ct.includes('json')
}

async function retryAfterRecovery(config: RetriableConfig) {
  if (!recoverMocks || config._mockRetry) return null
  config._mockRetry = true
  recovering ??= recoverMocks().finally(() => (recovering = null))
  await recovering
  return api.request(config)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * O app renderiza sem esperar o MSW (melhor LCP); as requisições é que aguardam o backend
 * simulado ficar pronto antes de sair.
 */
let apiReady: Promise<unknown> = Promise.resolve()
export function setApiReady(p: Promise<unknown>) {
  apiReady = p
}

api.interceptors.request.use(async (config) => {
  await apiReady
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  async (res) => {
    if (isNotJson(res)) {
      const retried = await retryAfterRecovery(res.config as RetriableConfig)
      if (retried) return retried
      throw new ApiError('TRANSIENT', 'O serviço não respondeu corretamente. Tente novamente.', res.status)
    }
    return res
  },
  async (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) throw error
    if (error.config && !error.response?.data?.error && isNotJson(error.response)) {
      const retried = await retryAfterRecovery(error.config as RetriableConfig)
      if (retried) return retried
    }
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
    const sentToken = String(error.config?.headers?.Authorization ?? '').replace(/^Bearer /, '')
    if ((apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHORIZED') && sentToken) {
      onAuthFailure(apiError.code, sentToken)
    }
    throw apiError
  },
)

export function isApiError(e: unknown, code?: ApiErrorCode): e is ApiError {
  return e instanceof ApiError && (!code || e.code === code)
}
