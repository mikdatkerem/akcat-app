import { apiUrl } from '../config/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let csrfToken: string | null = null
let sessionVersion = 0
const unauthorizedListeners = new Set<() => void>()

export function setCsrfToken(value: string | null) {
  if (csrfToken !== value) sessionVersion++
  csrfToken = value
}

export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => { unauthorizedListeners.delete(listener) }
}

function httpError(status: number, code: string) {
  const message = status === 401 ? (code === 'INVALID_CREDENTIALS' ? 'Kullanıcı adı veya parola hatalı.' : 'Oturumunuz geçerli değil. Lütfen tekrar giriş yapın.')
    : status === 403 ? 'İşleme izin verilmedi. Oturumunuzu kontrol edip tekrar deneyin.'
      : status === 429 ? 'Çok fazla giriş denemesi. Lütfen bir dakika sonra tekrar deneyin.'
        : status === 503 ? 'Giriş hizmeti şu anda kullanılamıyor. Lütfen sistem yöneticinizle iletişime geçin.'
          : status === 400 ? 'Kullanıcı adı ve parola biçimini kontrol edin.'
            : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
  return new ApiError(status, code, message)
}

// Shared cookie client: no Bearer credentials, persistent tokens or automatic mutation retries.
export async function apiRequest(path: `/api/${string}`, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
} = {}): Promise<unknown> {
  const method = options.method ?? 'GET'
  const login = path === '/api/v1/auth/login'
  const version = sessionVersion
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (method !== 'GET' && !login) {
    if (!csrfToken) throw new ApiError(403, 'CSRF_REQUIRED', 'Oturumunuzu kontrol edip tekrar deneyin.')
    headers.set('X-CSRF-Token', csrfToken)
  }
  let response: Response
  try {
    response = await fetch(apiUrl(path), { method, headers, credentials: 'include', cache: 'no-store',
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
  }
  if (response.status === 401 && !login && version === sessionVersion) {
    for (const listener of unauthorizedListeners) listener()
  }
  let data: unknown
  try { data = await response.json() } catch {
    if (!response.ok) throw httpError(response.status, 'HTTP_ERROR')
    throw new ApiError(0, 'INVALID_RESPONSE', 'Sunucudan beklenen yanıt alınamadı. Lütfen tekrar deneyin.')
  }
  if (!response.ok) {
    const code = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'object'
      && data.error !== null && 'code' in data.error && typeof data.error.code === 'string' ? data.error.code : 'HTTP_ERROR'
    throw httpError(response.status, code)
  }
  return data
}
