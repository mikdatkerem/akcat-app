import { useState } from 'react'
import { sessionStore } from '../auth/sessionStore'
import { ApiError } from '../services/apiClient'
type Pending = { key: string; body: unknown }
const pending = new Map<string, Pending>()
sessionStore.subscribe(() => { if (sessionStore.getSnapshot().status === 'anonymous') pending.clear() })
// Only in-memory uncertain writes survive temporary auth rechecks. No business data or tokens in browser storage.
export function useOperation<T>(actor: string, path: string, send: (body: T, key: string) => Promise<unknown>) {
  const scope = actor + ':' + path
  const [saved, setSaved] = useState(() => pending.get(scope))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function run(body: T) {
    if (busy) return false
    const write = pending.get(scope) ?? { key: crypto.randomUUID(), body: structuredClone(body) }
    pending.set(scope, write); setSaved(write); setBusy(true); setError('')
    try {
      await send(write.body as T, write.key); pending.delete(scope); setSaved(undefined); return true
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'İşlem tamamlanamadı. Güncel kaydı kontrol edin.')
      if (error instanceof ApiError && [400, 403, 404, 409, 413, 415, 422].includes(error.status)) { pending.delete(scope); setSaved(undefined) }
      return false
    } finally { setBusy(false) }
  }
  return { saved: saved?.body as T | undefined, busy, error, run }
}
