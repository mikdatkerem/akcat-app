import { recoverKey, forgetKey } from './pendingKey'
import { sessionStore } from '../auth/sessionStore'
import type { Customer } from '../services/customers'
import type { SaleSummary, PaymentMethod } from '../services/sales'
import type { PaymentInput } from '../services/finance'
type Draft = { actor: string; key: string; recovered: boolean; customer: Customer | null; sale: SaleSummary | null; amount: string; method: PaymentMethod | ''; pending: PaymentInput | null }
let current: Draft | undefined
sessionStore.subscribe(() => { if (sessionStore.getSnapshot().status === 'anonymous') current = undefined })
export function paymentDraft(actor: string, customer?: Customer, sale?: SaleSummary): Draft {
  if (!current || current.actor !== actor || (!current.pending && customer && current.customer?.id !== customer.id)) {
    const recovered = recoverKey(actor, 'payment')
    current = { actor, key: recovered ?? crypto.randomUUID(), recovered: !!recovered, customer: customer ?? null, sale: sale ?? null, amount: '', method: '', pending: null }
  } else if (!current.pending && sale && sale.id !== current.sale?.id) current = { ...current, sale }
  return current
}
export function updatePaymentDraft(actor: string, key: string, patch: Partial<Pick<Draft, 'customer' | 'sale' | 'amount' | 'method' | 'pending'>>) {
  if (current?.actor === actor && current.key === key) current = { ...current, ...patch }
}
export function clearPaymentDraft(actor: string) { if (current?.actor === actor) { forgetKey(actor, 'payment', current.key); current = undefined } }
export function discardPaymentDraft(actor: string) { if (!forgetKey(actor, 'payment')) return false; if (current?.actor === actor) current = undefined; return true }
