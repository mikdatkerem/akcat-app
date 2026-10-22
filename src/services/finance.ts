import type { AdjustmentKind } from './adjustments'
import { ApiError, apiRequest } from './apiClient'
import { readSaleSummary, type PaymentMethod, type SaleSummary } from './sales'

export type PageFilter = { page: number; pageSize: number }
export type PageInfo = PageFilter & { total: number; totalPages: number }
export type DebtSummary = { total_debt_kurus: number; open_sales_count: number; last_payment_at: string | null }
export type FinanceCustomer = { id: string; name: string; phone: string | null }
export type Debtor = FinanceCustomer & DebtSummary
export type CustomerDebt = { customer: FinanceCustomer; summary: DebtSummary; data: SaleSummary[]; pagination: PageInfo }
export type PaymentInput = { customer_id: string; sale_id: string; amount_kurus: number; method: PaymentMethod }
export type Payment = Omit<PaymentInput, 'sale_id'> & { id: string; customer_name: string; sale_id: string | null; created_by: string; created_by_username: string;
  created_at: string; adjustment_kind: AdjustmentKind | null; adjustment_id: string | null; is_initial: boolean; is_valid: boolean; reversal_of_payment_id: string | null; sale_remaining_kurus: number | null }
export type PaymentFilter = PageFilter & { customer_id?: string; sale_id?: string; method?: PaymentMethod; from?: string; to?: string; status?: 'all' | 'valid' }
export type LedgerFilter = PageFilter & { type?: 'all' | 'sale' | 'payment' | 'reversal' | 'record_reversal' | 'external_refund' | 'cancellation'; from?: string; to?: string }
export type LedgerEntry = { id: string; type: 'sale' | 'payment' | 'reversal' | 'record_reversal' | 'external_refund' | 'cancellation'; sale_id: string; amount_kurus: number; method: PaymentMethod | null;
  created_by: string; created_by_username: string; created_at: string; effective: boolean; balance_after_kurus: number; sale_balance_after_kurus: number }
export type Ledger = { customer: FinanceCustomer; summary: DebtSummary; data: LedgerEntry[]; pagination: PageInfo }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Finansal veriler doğrulanamadı. Lütfen tekrar deneyin.')
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object') throw invalid(); return value as Record<string, unknown> }
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
function customer(value: unknown): FinanceCustomer {
  const row = object(value)
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || (row.phone !== null && typeof row.phone !== 'string')) throw invalid()
  return row as FinanceCustomer
}
function summary(value: unknown): DebtSummary {
  const row = object(value)
  if (!money(row.total_debt_kurus) || !money(row.open_sales_count) || (row.last_payment_at !== null && !date(row.last_payment_at))) throw invalid()
  return row as DebtSummary
}
function paged<T>(value: unknown, filter: PageFilter, read: (value: unknown) => T) {
  const row = object(value), page = object(row.pagination)
  if (!Array.isArray(row.data) || !['page', 'pageSize', 'total', 'totalPages'].every(key => money(page[key]))
    || page.page !== filter.page || page.pageSize !== filter.pageSize || row.data.length > filter.pageSize
    || page.totalPages !== Math.ceil(Number(page.total) / filter.pageSize)) throw invalid()
  return { data: row.data.map(read), pagination: page as PageInfo }
}
function payment(value: unknown): Payment {
  const row = object(value)
  if (!['id', 'customer_id', 'customer_name', 'created_by', 'created_by_username'].every(key => typeof row[key] === 'string')
    || (row.sale_id !== null && typeof row.sale_id !== 'string') || !money(row.amount_kurus) || row.amount_kurus === 0 || !['cash', 'card', 'bank'].includes(String(row.method))
    || (row.adjustment_kind !== null && !['record_reversal', 'external_refund'].includes(String(row.adjustment_kind)))
    || (row.adjustment_id !== null && typeof row.adjustment_id !== 'string')
    || !date(row.created_at) || typeof row.is_initial !== 'boolean' || typeof row.is_valid !== 'boolean'
    || (row.reversal_of_payment_id !== null && typeof row.reversal_of_payment_id !== 'string') || (row.sale_remaining_kurus !== null && !money(row.sale_remaining_kurus))) throw invalid()
  return row as Payment
}
function entry(value: unknown): LedgerEntry {
  const row = object(value)
  if (!['id', 'sale_id', 'created_by', 'created_by_username'].every(key => typeof row[key] === 'string') || !['sale', 'payment', 'reversal', 'record_reversal', 'external_refund', 'cancellation'].includes(String(row.type))
    || !money(row.amount_kurus) || !date(row.created_at) || typeof row.effective !== 'boolean'
    || (row.method !== null && !['cash', 'card', 'bank'].includes(String(row.method)))
    || typeof row.balance_after_kurus !== 'number' || !Number.isSafeInteger(row.balance_after_kurus)
    || typeof row.sale_balance_after_kurus !== 'number' || !Number.isSafeInteger(row.sale_balance_after_kurus)) throw invalid()
  return row as LedgerEntry
}
function query(filter: object) {
  return new URLSearchParams(Object.entries(filter).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]))
}
export async function customerReceivables(id: string, filter: PageFilter): Promise<CustomerDebt> {
  const row = object(await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/receivables?${query(filter)}`))
  return { ...paged(row, filter, readSaleSummary), customer: customer(row.customer), summary: summary(row.summary) }
}
export async function customerLedger(id: string, filter: LedgerFilter): Promise<Ledger> {
  const row = object(await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/ledger?${query(filter)}`))
  return { ...paged(row, filter, entry), customer: customer(row.customer), summary: summary(row.summary) }
}
export async function listReceivables(filter: PageFilter & { q: string }) {
  return paged(await apiRequest(`/api/v1/receivables?${query(filter)}`), filter, value => ({ ...customer(value), ...summary(value) } as Debtor))
}
export async function listPayments(filter: PaymentFilter) { return paged(await apiRequest(`/api/v1/payments?${query(filter)}`), filter, payment) }
export async function createPayment(body: PaymentInput, key: string) { return payment(object(await apiRequest('/api/v1/payments', { method: 'POST', body, idempotencyKey: key })).data) }
export { payment as readPayment }
