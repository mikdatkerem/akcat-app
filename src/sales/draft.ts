import { recoverKey, forgetKey } from '../finance/pendingKey'
import type { Customer } from '../services/customers'
import type { Product } from '../services/products'
import type { PaymentMethod, SaleInput } from '../services/sales'
import { sessionStore } from '../auth/sessionStore'

export type DraftLine = { product: Product; quantity: string }
type Draft = { actor: string; key: string; recovered: boolean; customer: Customer | null; lines: DraftLine[]; payment: string; method: PaymentMethod | ''; pending: SaleInput | null }
let draft: Draft | undefined
// Keep the draft across temporary auth checks/unmounts, scoped to the current user and browser memory only.
sessionStore.subscribe(() => { if (sessionStore.getSnapshot().status === 'anonymous') draft = undefined })
export function saleDraft(actor: string): Draft {
  if (!draft || draft.actor !== actor) {
    const recovered = recoverKey(actor, 'sale')
    draft = { actor, key: recovered ?? crypto.randomUUID(), recovered: !!recovered, customer: null, lines: [], payment: '0', method: '', pending: null }
  }
  return draft
}
export function clearSaleDraft(actor: string) { if (draft?.actor === actor) { forgetKey(actor, 'sale', draft.key); draft = undefined } }
export function discardSaleDraft(actor: string) { if (!forgetKey(actor, 'sale')) return false; if (draft?.actor === actor) draft = undefined; return true }
export function updateSaleDraft(actor: string, key: string, values: Partial<Pick<Draft, 'customer' | 'lines' | 'payment' | 'method' | 'pending'>>) {
  if (draft?.actor === actor && draft.key === key) draft = { ...draft, ...values }
}
