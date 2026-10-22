import { readAdjustmentTotals, type AdjustmentTotals } from './adjustments'
import { ApiError, apiRequest } from './apiClient'
import { readSaleSummary, type SaleSummary } from './sales'
import { readPayment, type Payment, type PageInfo } from './finance'
export type Period = 'today' | 'yesterday' | 'last7' | 'month' | 'custom'
export type ReportFilter = { period: Period; from?: string; to?: string; q?: string; created_by?: string; view?: 'sales' | 'cancelled' | 'items' | 'products'; page: number; pageSize: number }
export type ReportRange = { period: Period; from: string; to: string; start_date: string; end_date: string; time_zone: 'Europe/Istanbul'; generated_at: string }
export type SalesTotals = { sales_total_kurus: number; sales_count: number; cancelled_total_kurus: number; cancelled_count: number }
export type PaymentTotals = { payments_total_kurus: number; payments_count: number; cash_kurus: number; card_kurus: number; bank_kurus: number }
export type DebtTotals = { total_debt_kurus: number; debtor_count: number; open_sales_count: number; sales_total_kurus: number; paid_kurus: number }
export type Recent = { id: string; type: 'sale' | 'payment' | 'cancellation' | 'record_reversal' | 'external_refund'; sale_id: string | null; customer_id: string; customer_name: string;
  amount_kurus: number; created_by: string; created_by_username: string; created_at: string; status: string }
export type ReportItem = { id: string; sale_id: string; product_id: string; product_name_snapshot: string; unit_price_kurus: number; quantity: number;
  line_total_kurus: number; created_at: string; created_by_username: string; customer_name: string }
export type ReportProduct = { product_id: string; product_name_snapshot: string; unit_price_kurus: number; quantity: number; total_kurus: number }
export type ReportDebtor = { id: string; name: string; phone: string | null; total_debt_kurus: number; open_sales_count: number; sales_total_kurus: number; paid_kurus: number; last_payment_at: string | null }
export type ReportEmployee = SalesTotals & PaymentTotals & AdjustmentTotals & { id: string; username: string }
export type ReportPage<T> = { range: ReportRange; data: T[]; pagination: PageInfo }
export type SummaryReport = { range: ReportRange; sales: SalesTotals; payments: PaymentTotals; adjustments: AdjustmentTotals; receivables: DebtTotals; recent: Recent[] }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Rapor verileri doğrulanamadı. Lütfen tekrar deneyin.')
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object') throw invalid(); return value as Record<string, unknown> }
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
function numbers(value: unknown, fields: readonly string[]) { const row = object(value); if (!fields.every(field => money(row[field]))) throw invalid(); return row }
function salesTotals(value: unknown) { return numbers(value, ['sales_total_kurus', 'sales_count', 'cancelled_total_kurus', 'cancelled_count']) as SalesTotals }
function paymentTotals(value: unknown) {
  const row = numbers(value, ['payments_total_kurus', 'payments_count', 'cash_kurus', 'card_kurus', 'bank_kurus']) as PaymentTotals
  if (BigInt(row.payments_total_kurus) !== BigInt(row.cash_kurus) + BigInt(row.card_kurus) + BigInt(row.bank_kurus)) throw invalid()
  return row
}
function debtTotals(value: unknown) {
  const row = numbers(value, ['total_debt_kurus', 'debtor_count', 'open_sales_count', 'sales_total_kurus', 'paid_kurus']) as DebtTotals
  if (BigInt(row.total_debt_kurus) !== BigInt(row.sales_total_kurus) - BigInt(row.paid_kurus)) throw invalid()
  return row
}
function range(value: unknown): ReportRange {
  const row = object(value)
  if (row.time_zone !== 'Europe/Istanbul' || !['today', 'yesterday', 'last7', 'month', 'custom'].includes(String(row.period))
    || !date(row.from) || !date(row.to) || !date(row.generated_at) || String(row.from) >= String(row.to)
    || !['start_date', 'end_date'].every(key => typeof row[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(row[key])))) throw invalid()
  return row as ReportRange
}
function recent(value: unknown): Recent {
  const row = object(value)
  if (!['id', 'customer_id', 'customer_name', 'created_by', 'created_by_username', 'status'].every(key => typeof row[key] === 'string')
    || !['sale', 'payment', 'cancellation', 'record_reversal', 'external_refund'].includes(String(row.type)) || !money(row.amount_kurus) || !date(row.created_at)
    || (row.sale_id !== null && typeof row.sale_id !== 'string')) throw invalid()
  return row as Recent
}
function product(value: unknown): ReportProduct {
  const row = numbers(value, ['unit_price_kurus', 'quantity', 'total_kurus'])
  if (typeof row.product_id !== 'string' || typeof row.product_name_snapshot !== 'string'
    || BigInt(Number(row.unit_price_kurus)) * BigInt(Number(row.quantity)) !== BigInt(Number(row.total_kurus))) throw invalid()
  return row as ReportProduct
}
function item(value: unknown): ReportItem {
  const row = numbers(value, ['unit_price_kurus', 'quantity', 'line_total_kurus'])
  if (!['id', 'sale_id', 'product_id', 'product_name_snapshot', 'customer_name', 'created_by_username'].every(key => typeof row[key] === 'string') || !date(row.created_at)
    || BigInt(Number(row.unit_price_kurus)) * BigInt(Number(row.quantity)) !== BigInt(Number(row.line_total_kurus))) throw invalid()
  return row as ReportItem
}
function debtor(value: unknown): ReportDebtor {
  const row = numbers(value, ['total_debt_kurus', 'open_sales_count', 'sales_total_kurus', 'paid_kurus'])
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || (row.phone !== null && typeof row.phone !== 'string')
    || (row.last_payment_at !== null && !date(row.last_payment_at)) || BigInt(Number(row.total_debt_kurus)) !== BigInt(Number(row.sales_total_kurus)) - BigInt(Number(row.paid_kurus))) throw invalid()
  return row as ReportDebtor
}
function employee(value: unknown): ReportEmployee {
  const row = object(value); salesTotals(row); paymentTotals(row); readAdjustmentTotals(row)
  if (typeof row.id !== 'string' || typeof row.username !== 'string') throw invalid()
  return row as ReportEmployee
}
function page<T>(value: unknown, filter: ReportFilter, read: (value: unknown) => T): ReportPage<T> {
  const row = object(value), info = numbers(row.pagination, ['page', 'pageSize', 'total', 'totalPages'])
  if (!Array.isArray(row.data) || info.page !== filter.page || info.pageSize !== filter.pageSize || row.data.length > filter.pageSize
    || info.totalPages !== Math.ceil(Number(info.total) / filter.pageSize)) throw invalid()
  return { range: range(row.range), data: row.data.map(read), pagination: info as PageInfo }
}
export function reportQuery(filter: Partial<ReportFilter>) {
  return new URLSearchParams(Object.entries(filter).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]))
}
export async function getSummaryReport(): Promise<SummaryReport> {
  const row = object(await apiRequest('/api/v1/reports/summary?period=today'))
  if (!Array.isArray(row.recent) || row.recent.length > 10) throw invalid()
  return { range: range(row.range), sales: salesTotals(row.sales), payments: paymentTotals(row.payments), adjustments: readAdjustmentTotals(row.adjustments), receivables: debtTotals(row.receivables), recent: row.recent.map(recent) }
}
export async function getSalesReport(filter: ReportFilter) {
  const row = object(await apiRequest(`/api/v1/reports/sales?${reportQuery(filter)}`))
  if (row.view !== (filter.view ?? 'sales')) throw invalid()
  const read: (value: unknown) => SaleSummary | ReportItem | ReportProduct = row.view === 'products' ? product : row.view === 'items' ? item : readSaleSummary
  return { ...page(row, filter, read), summary: salesTotals(row.summary) }
}
export async function getPaymentsReport(filter: ReportFilter): Promise<ReportPage<Payment> & { summary: PaymentTotals; adjustments: AdjustmentTotals }> {
  const row = object(await apiRequest(`/api/v1/reports/payments?${reportQuery(filter)}`))
  return { ...page(row, filter, value => { const payment = readPayment(value); if (!payment.is_valid) throw invalid(); return payment }), summary: paymentTotals(row.summary), adjustments: readAdjustmentTotals(row.adjustments) }
}
export async function getDebtReport(filter: ReportFilter) {
  const row = object(await apiRequest(`/api/v1/reports/receivables?${reportQuery(filter)}`))
  if (row.balance_scope !== 'current') throw invalid()
  return { ...page(row, filter, debtor), summary: debtTotals(row.summary) }
}
export async function getEmployeesReport(filter: ReportFilter) {
  return page(await apiRequest(`/api/v1/reports/employees?${reportQuery(filter)}`), filter, employee)
}
