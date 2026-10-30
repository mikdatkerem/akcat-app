import { ApiError, onUnauthorized, setCsrfToken } from '../services/apiClient'
import * as authApi from '../services/auth'
import type { Session } from '../services/auth'

type Snapshot = {
  status: 'checking' | 'authenticated' | 'anonymous' | 'unavailable'
  session: Session | null
  busy: 'login' | 'logout' | null
  error: string | null
  notice?: string
}

let snapshot: Snapshot = { status: 'checking', session: null, busy: null, error: null }
const listeners = new Set<() => void>()
let revision = 0
let checking: Promise<void> | null = null
let lastCheckedAt = 0

function publish(next: Snapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

function accept(session: Session) {
  setCsrfToken(session.csrfToken)
  lastCheckedAt = Date.now()
  publish({ status: 'authenticated', session, busy: null, error: null })
}

onUnauthorized(() => {
  revision++
  lastCheckedAt = Date.now()
  setCsrfToken(null)
  publish({ status: 'anonymous', session: null, busy: null,
    error: snapshot.busy === 'login' ? 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' : null })
})

export const sessionStore = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
}

export function checkSession({ quiet = false } = {}): Promise<void> {
  if (snapshot.busy) return Promise.resolve()
  if (checking) return checking
  if (quiet && snapshot.status !== 'authenticated') return Promise.resolve()
  if (quiet && Date.now() - lastCheckedAt < 30_000) return Promise.resolve()
  const ticket = ++revision
  const authenticated = snapshot.status === 'authenticated' && !!snapshot.session
  publish({ ...snapshot, status: authenticated ? 'authenticated' : 'checking', error: null })
  checking = (async () => {
    try {
      const session = await authApi.getSession()
      if (ticket === revision) accept(session)
    } catch (error) {
      if (ticket !== revision) return
      if (error instanceof ApiError && error.status === 401) {
        setCsrfToken(null)
        publish({ status: 'anonymous', session: null, busy: null, error: null })
      } else {
        // A transient recheck failure must not unmount authenticated forms. API authorization remains authoritative.
        publish({ ...snapshot, status: authenticated ? 'authenticated' : 'unavailable', error: error instanceof ApiError ? error.message : 'Bağlantınızı kontrol edip tekrar deneyin.' })
      }
    } finally { checking = null }
  })()
  return checking
}

export async function signIn(username: string, password: string): Promise<boolean> {
  if (snapshot.busy) return false
  const ticket = ++revision
  publish({ ...snapshot, busy: 'login', error: null })
  try {
    const created = await authApi.login(username, password)
    if (ticket !== revision) return false
    setCsrfToken(created.csrfToken)
    // Confirm the browser actually accepted its HttpOnly cookie before rendering protected pages.
    const session = await authApi.getSession()
    if (ticket !== revision) return false
    accept(session)
    return true
  } catch (error) {
    if (ticket === revision) {
      setCsrfToken(null)
      publish({ ...snapshot, busy: null,
        error: error instanceof ApiError ? error.message : 'Giriş tamamlanamadı. Lütfen tekrar deneyin.' })
    }
    return false
  }
}

export async function signOut(): Promise<void> {
  if (snapshot.busy || snapshot.status !== 'authenticated') return
  const ticket = ++revision
  publish({ ...snapshot, busy: 'logout', error: null })
  try {
    await authApi.logout()
    if (ticket !== revision) return
    setCsrfToken(null)
    publish({ status: 'anonymous', session: null, busy: null, error: null })
  } catch (error) {
    if (ticket === revision) publish({ ...snapshot, busy: null,
      error: error instanceof ApiError ? error.message : 'Çıkış tamamlanamadı. Lütfen tekrar deneyin.' })
  }
}

// Only call after the server confirmed the atomic change and revoked every session.
export function passwordChanged() {
  revision++
  lastCheckedAt = Date.now()
  setCsrfToken(null)
  publish({ status: 'anonymous', session: null, busy: null, error: null,
    notice: 'Parolanız değiştirildi ve tüm oturumlarınız kapatıldı. Yeni parolanızla giriş yapın.' })
}
