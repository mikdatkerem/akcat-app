import { sessionStore } from '../auth/sessionStore'
import { recoverKey, forgetKey } from './pendingKey'
import type { Customer } from '../services/customers'
import type { CollectionInput } from '../services/collections'
import type { PaymentMethod } from '../services/sales'
type Draft = { actor: string; key: string; recovered: boolean; customer: Customer | null; amount: string; method: PaymentMethod; pending: CollectionInput | null }
let draft: Draft | undefined
sessionStore.subscribe(() => { if (sessionStore.getSnapshot().status === 'anonymous') draft = undefined })
export function collectionDraft(actor: string, customer?: Customer): Draft {
  if (!draft || draft.actor !== actor || (!draft.pending && customer && draft.customer?.id !== customer.id)) {
    const key = recoverKey(actor, 'collection')
    draft = { actor, key: key ?? crypto.randomUUID(), recovered: !!key, customer: customer ?? null, amount: '', method: 'cash', pending: null }
  }
  return draft
}
export function updateCollectionDraft(actor: string, patch: Partial<Pick<Draft, 'customer' | 'amount' | 'method' | 'pending'>>) {
  if (draft?.actor === actor) Object.assign(draft, patch)
}
export function discardCollectionDraft(actor: string) {
  if (!forgetKey(actor, 'collection')) return false
  if (draft?.actor === actor) draft = undefined
  return true
}
