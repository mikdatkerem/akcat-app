import { ApiError, apiRequest } from './apiClient'

export type Role = 'admin' | 'employee'
export type User = { id: string; username: string; role: Role }
export type Session = { user: User; expiresAt: string; csrfToken: string }

function readSession(data: unknown): Session {
  if (typeof data === 'object' && data !== null && 'user' in data && 'expiresAt' in data && 'csrfToken' in data) {
    const user = data.user
    if (typeof user === 'object' && user !== null && 'id' in user && 'username' in user && 'role' in user
      && typeof user.id === 'string' && typeof user.username === 'string' && (user.role === 'admin' || user.role === 'employee')
      && typeof data.expiresAt === 'string' && Number.isFinite(Date.parse(data.expiresAt))
      && typeof data.csrfToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(data.csrfToken)) {
      return { user: { id: user.id, username: user.username, role: user.role }, expiresAt: data.expiresAt, csrfToken: data.csrfToken }
    }
  }
  // Web uses cookies, so a successful session response must include its CSRF token.
  throw new ApiError(0, 'INVALID_RESPONSE', 'Oturum bilgisi doğrulanamadı. Lütfen tekrar deneyin.')
}

export const getSession = async () => readSession(await apiRequest('/api/v1/auth/me'))
export const login = async (username: string, password: string) => readSession(await apiRequest('/api/v1/auth/login', {
  method: 'POST', body: { username, password },
}))
export async function logout() {
  const data = await apiRequest('/api/v1/auth/logout', { method: 'POST' })
  if (typeof data !== 'object' || data === null || !('success' in data) || data.success !== true) {
    throw new ApiError(0, 'INVALID_RESPONSE', 'Çıkış işlemi doğrulanamadı. Oturumunuzu tekrar kontrol edin.')
  }
}

export type Account = User & { is_active: boolean }
export async function getAccount(): Promise<Account> {
  const data = await apiRequest('/api/v1/auth/me')
  const session = readSession(data)
  if (typeof data !== 'object' || data === null || !('is_active' in data) || typeof data.is_active !== 'boolean') {
    throw new ApiError(0, 'INVALID_RESPONSE', 'Hesap durumu doğrulanamadı. Lütfen tekrar deneyin.')
  }
  return { ...session.user, is_active: data.is_active }
}

export async function changePassword(current_password: string, new_password: string) {
  const data = await apiRequest('/api/v1/auth/change-password', { method: 'POST', body: { current_password, new_password } })
  if (typeof data !== 'object' || data === null || !('success' in data) || data.success !== true) {
    throw new ApiError(0, 'INVALID_RESPONSE', 'Parola değişikliğinin sonucu doğrulanamadı.')
  }
}
