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
  if (code === 'INVALID_REPORT_INPUT') return new ApiError(status, code, 'Rapor dönemini, tarih aralığını, aramayı ve sayfalamayı kontrol edin.')
  const correctionErrors: Record<string, string> = {
    INVALID_CORRECTION_INPUT: 'Hedef kaydı, düzeltme türünü, gerekçeyi ve istenen değişikliği kontrol edin.',
    CORRECTION_NOT_FOUND: 'Düzeltme talebi bulunamadı.', CORRECTION_TARGET_NOT_FOUND: 'Düzeltilecek kayıt bulunamadı.',
    CORRECTION_NOT_PENDING: 'Talep artık beklemiyor. Güncel talep durumunu kontrol edin.',
    FINANCIAL_PREVIEW_REQUIRED: 'Güncel tutarı ve bakiyeleri inceleyerek onaylayın.',
    FINANCIAL_ADJUSTMENT_DENIED: 'İşlem uygulanmadı. Güncel talep, ödeme ve bakiyeleri yeniden yükleyin; harici iadenin teyidi ile referansını kontrol edin. Kısmi veya ikinci tam ters kayıt desteklenmez.',
    CORRECTION_UNSUPPORTED: 'Talep uygulanamıyor. Önce tüm ödemeleri teyitli iade veya hatalı kayıt ters kaydıyla kapatın. Kısmi düzeltme ve doğrudan tutar/yöntem değişikliği desteklenmez.',
    SALE_CANCELLATION_DENIED: 'Satış iptal edilemedi. Hiç ödeme kaydı bulunmamalı; çalışan yalnızca kendi satışını ilk beş dakika içinde iptal edebilir. Güncel kaydı kontrol edin veya düzeltme talebi oluşturun.',
  }
  if (correctionErrors[code]) return new ApiError(status, code, correctionErrors[code])
  if (code === 'INVALID_FINANCE_INPUT') return new ApiError(status, code, 'Müşteriyi, satışı, tutarı, ödeme yöntemini ve filtreleri kontrol edin.')
  if (code === 'PAYMENT_NOT_ALLOWED') return new ApiError(status, code, 'Tahsilat kaydedilmedi. Müşteri/satış eşleşmesini ve güncel kalan borcu kontrol edin.')
  if (code === 'SALE_NOT_FOUND') return new ApiError(status, code, 'Satış bulunamadı.')
  if (code === 'INVALID_SALE_INPUT') return new ApiError(status, code, 'Müşteriyi, miktarları, ödeme ve filtre alanlarını kontrol edin.')
  if (code === 'SALE_NOT_ALLOWED') return new ApiError(status, code, 'Satış kaydedilmedi. Müşteri/ürün aktifliğini, güncel fiyatları ve ödeme tutarını kontrol edin.')
  const message = status === 401 ? (code === 'INVALID_CREDENTIALS' ? 'Kullanıcı adı veya parola hatalı.' : 'Oturumunuz geçerli değil. Lütfen tekrar giriş yapın.')
    : status === 403 ? 'İşleme izin verilmedi. Oturumunuzu kontrol edip tekrar deneyin.'
      : status === 429 ? 'Çok fazla giriş denemesi. Lütfen bir dakika sonra tekrar deneyin.'
        : status === 503 ? 'Giriş hizmeti şu anda kullanılamıyor. Lütfen sistem yöneticinizle iletişime geçin.'
          : status === 400 ? (code === 'INVALID_CUSTOMER_INPUT' ? 'Müşteri bilgilerini, telefonu ve filtreleri kontrol edin.' : code === 'INVALID_PRODUCT_INPUT' ? 'Ürün adını, fiyatı ve filtreleri kontrol edin.' : 'Kullanıcı adı ve parola biçimini kontrol edin.')
            : status === 404 && code === 'CUSTOMER_NOT_FOUND' ? 'Müşteri bulunamadı.'
              : status === 404 && code === 'PRODUCT_NOT_FOUND' ? 'Ürün bulunamadı.'
                : status === 409 ? 'Önceki işlem farklı bilgilerle kaydedilmiş olabilir. Listeyi kontrol edin.'
            : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
  return new ApiError(status, code, message)
}

// Shared cookie client: no Bearer credentials, persistent tokens or automatic mutation retries.
export async function apiRequest(path: `/api/${string}`, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  idempotencyKey?: string
} = {}): Promise<unknown> {
  const method = options.method ?? 'GET'
  const login = path === '/api/v1/auth/login'
  const version = sessionVersion
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
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
