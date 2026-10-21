import { useEffect, useSyncExternalStore } from 'react'
import { checkSession, sessionStore } from './sessionStore'

export function useSession() {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)

  useEffect(() => {
    void checkSession()
    const recheck = () => {
      if (document.visibilityState === 'visible') void checkSession({ quiet: true })
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.session) return
    // A check refreshes client knowledge and CSRF, never extends the server's fixed session expiry.
    const remaining = Math.max(0, Date.parse(state.session.expiresAt) - Date.now())
    const timer = window.setTimeout(() => { void checkSession() }, Math.min(remaining + 100, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [state.status, state.session, state.busy])

  return state
}
