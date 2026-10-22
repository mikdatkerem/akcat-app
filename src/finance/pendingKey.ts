// Only an opaque idempotency UUID is persisted per public user ID and operation.
// Never store credentials, CSRF, request bodies, customer data, prices or amounts.
type Kind = 'sale' | 'payment'
const storageKey = (actor: string, kind: Kind) => `akcat:pending:v1:${actor}:${kind}`
export function recoverKey(actor: string, kind: Kind): string | null {
  try { return sessionStorage.getItem(storageKey(actor, kind)) } catch { return null }
}
export function rememberKey(actor: string, kind: Kind, key: string) {
  const name = storageKey(actor, kind), existing = sessionStorage.getItem(name)
  if (existing && existing !== key) throw new Error('Unresolved operation')
  sessionStorage.setItem(name, key)
}
export function forgetKey(actor: string, kind: Kind, expected?: string): boolean {
  try {
    const name = storageKey(actor, kind)
    if (!expected || sessionStorage.getItem(name) === expected) sessionStorage.removeItem(name)
    return true
  } catch { return false }
}
