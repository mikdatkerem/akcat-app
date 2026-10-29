import { ApiError, apiRequest } from './apiClient'

export type PaymentMethod = 'cash' | 'card' | 'bank'
export type SaleInput = { customer_id: string; items: { product_id: string; quantity: number; unit_price_kurus?: number }[]; payment: { amount_kurus: number; method: PaymentMethod | null } }
export type SaleSummary = { id: string; customer_id: string; customer_name: string; created_by: string; created_by_username: string;
  status: 'completed' | 'cancelled'; total_kurus: number; paid_kurus: number; remaining_kurus: number;
  payment_status: 'paid' | 'partial' | 'credit'; created_at: string; updated_at: string }
export type Sale = SaleSummary & { cancellation_eligibility: { allowed: boolean; expires_at: string | null; explanation: string };
  cancellation_history: { actor_user_id: string; username: string; created_at: string; reason: string; correction_id: string | null; approved_by: string | null }[];
  customer: { id: string; name: string; phone: string | null; address: string };
  items: { id: string; product_id: string; product_name_snapshot: string; list_unit_price_kurus: number | null; unit_price_kurus: number; quantity: number; line_total_kurus: number }[];
  payments: { id: string; amount_kurus: number; method: PaymentMethod; created_at: string; created_by: string; created_by_username: string; is_initial: boolean }[] }
export type SaleFilter = { customer_id?: string; from?: string; to?: string; page: number; pageSize: number }
export type SaleList = { data: SaleSummary[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Satış verileri doğrulanamadı. Aynı işlem anahtarıyla tekrar deneyin veya satış geçmişini kontrol edin.')
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object') throw invalid(); return value as Record<string, unknown> }
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
function summary(value: unknown): SaleSummary {
  const row = record(value)
  if (!['id', 'customer_id', 'customer_name', 'created_by', 'created_by_username'].every(key => typeof row[key] === 'string')
    || !['completed', 'cancelled'].includes(String(row.status)) || !date(row.created_at) || !date(row.updated_at)
    || !money(row.total_kurus) || !money(row.paid_kurus) || !money(row.remaining_kurus) || row.paid_kurus > row.total_kurus
    || row.remaining_kurus !== (row.status === 'cancelled' ? 0 : row.total_kurus - row.paid_kurus)
    || row.payment_status !== (row.paid_kurus === row.total_kurus ? 'paid' : row.paid_kurus > 0 ? 'partial' : 'credit')) throw invalid()
  return row as SaleSummary
}
function single(value: unknown): Sale {
  const row = record(record(value).data)
  const base = summary(row), customer = record(row.customer)
  const eligibility = record(row.cancellation_eligibility)
  if (typeof eligibility.allowed !== 'boolean' || typeof eligibility.explanation !== 'string'
    || (eligibility.expires_at !== null && !date(eligibility.expires_at)) || !Array.isArray(row.cancellation_history)) throw invalid()
  for (const value of row.cancellation_history) {
    const log = record(value)
    if (!['actor_user_id', 'username', 'reason'].every(key => typeof log[key] === 'string') || !date(log.created_at)
      || (log.correction_id !== null && typeof log.correction_id !== 'string') || (log.approved_by !== null && typeof log.approved_by !== 'string')) throw invalid()
  }
  if (customer.id !== base.customer_id || typeof customer.name !== 'string' || typeof customer.address !== 'string'
    || (customer.phone !== null && typeof customer.phone !== 'string') || !Array.isArray(row.items) || !row.items.length || !Array.isArray(row.payments)) throw invalid()
  let total = 0n, paid = 0n
  for (const value of row.items) {
    const item = record(value)
    // Missing snapshots from older API versions/history are unknown, never inferred from today's catalog.
    item.list_unit_price_kurus ??= null
    if (typeof item.id !== 'string' || typeof item.product_id !== 'string' || typeof item.product_name_snapshot !== 'string'
      || (item.list_unit_price_kurus !== null && !money(item.list_unit_price_kurus))
      || !money(item.unit_price_kurus) || !money(item.quantity) || item.quantity === 0 || !money(item.line_total_kurus)
      || BigInt(item.unit_price_kurus) * BigInt(item.quantity) !== BigInt(item.line_total_kurus)) throw invalid()
    total += BigInt(item.line_total_kurus)
  }
  for (const value of row.payments) {
    const payment = record(value)
    if (typeof payment.id !== 'string' || !money(payment.amount_kurus) || payment.amount_kurus === 0 || !['cash', 'card', 'bank'].includes(String(payment.method))
      || !date(payment.created_at) || typeof payment.created_by !== 'string' || typeof payment.created_by_username !== 'string' || typeof payment.is_initial !== 'boolean') throw invalid()
    paid += BigInt(payment.amount_kurus)
  }
  if (total !== BigInt(base.total_kurus) || paid !== BigInt(base.paid_kurus)) throw invalid()
  return row as Sale
}
export async function listSales(filter: SaleFilter): Promise<SaleList> {
  const query = new URLSearchParams({ page: String(filter.page), pageSize: String(filter.pageSize) })
  for (const key of ['customer_id', 'from', 'to'] as const) if (filter[key]) query.set(key, filter[key])
  const row = record(await apiRequest(`/api/v1/sales?${query}`)), page = record(row.pagination)
  if (!Array.isArray(row.data) || !['page', 'pageSize', 'total', 'totalPages'].every(key => money(page[key]))
    || page.page !== filter.page || page.pageSize !== filter.pageSize || row.data.length > filter.pageSize
    || page.totalPages !== Math.ceil(Number(page.total) / filter.pageSize)) throw invalid()
  return { data: row.data.map(summary), pagination: page as SaleList['pagination'] }
}
export const getSale = async (id: string) => single(await apiRequest(`/api/v1/sales/${encodeURIComponent(id)}`))
export const createSale = async (body: SaleInput, key: string) => single(await apiRequest('/api/v1/sales', { method: 'POST', body, idempotencyKey: key }))
export { summary as readSaleSummary }
export { single as readSale }
