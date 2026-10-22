import { ApiError, apiRequest } from './apiClient'
import type { PageFilter, PageInfo } from './finance'
import type { PaymentMethod } from './sales'

export type AdjustmentKind = 'record_reversal' | 'external_refund'
export type FinancialPreview = { payment_id: string; sale_id: string; customer_id: string; customer_name: string; amount_kurus: number; method: PaymentMethod;
  original_created_at: string; original_created_by_username: string; before_sale_remaining_kurus: number; after_sale_remaining_kurus: number;
  before_customer_debt_kurus: number; after_customer_debt_kurus: number; requires_external_confirmation: boolean }
export type Adjustment = Omit<FinancialPreview, 'original_created_at' | 'original_created_by_username' | 'requires_external_confirmation'> & {
  id: string; correction_request_id: string; reversal_payment_id: string; kind: AdjustmentKind; reason: string; created_at: string;
  requested_by: string; requested_by_username: string; performed_by: string; performed_by_username: string; approved_by: string; approved_by_username: string;
  external_reference: string | null; external_confirmed_at: string | null }
export type AdjustmentFilter = PageFilter & { customer_id?: string; sale_id?: string; created_by?: string; kind?: AdjustmentKind; from?: string; to?: string }
export type AdjustmentTotals = { record_reversal_kurus: number; record_reversal_count: number; external_refund_kurus: number; external_refund_count: number;
  reversal_cash_kurus: number; reversal_card_kurus: number; reversal_bank_kurus: number; refund_cash_kurus: number; refund_card_kurus: number; refund_bank_kurus: number }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Finansal düzeltme yanıtı doğrulanamadı. İşlem geçmişini kontrol edin.')
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object') throw invalid(); return value as Record<string, unknown> }
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
function balances(row: Record<string, unknown>) {
  if (!['amount_kurus', 'before_sale_remaining_kurus', 'after_sale_remaining_kurus', 'before_customer_debt_kurus', 'after_customer_debt_kurus'].every(key => money(row[key]))
    || row.amount_kurus === 0 || !['cash', 'card', 'bank'].includes(String(row.method))
    || !['payment_id', 'sale_id', 'customer_id', 'customer_name'].every(key => typeof row[key] === 'string')) throw invalid()
  for (const scope of ['sale_remaining', 'customer_debt']) {
    if (BigInt(Number(row[`before_${scope}_kurus`])) + BigInt(Number(row.amount_kurus)) !== BigInt(Number(row[`after_${scope}_kurus`]))) throw invalid()
  }
}
export function readFinancialPreview(value: unknown): FinancialPreview {
  const row = object(value); balances(row)
  if (typeof row.requires_external_confirmation !== 'boolean' || !date(row.original_created_at) || typeof row.original_created_by_username !== 'string') throw invalid()
  return row as FinancialPreview
}
export function readAdjustment(value: unknown): Adjustment {
  const row = object(value); balances(row)
  if (!['id', 'correction_request_id', 'reversal_payment_id', 'reason', 'requested_by', 'requested_by_username', 'performed_by', 'performed_by_username', 'approved_by', 'approved_by_username'].every(key => typeof row[key] === 'string')
    || !date(row.created_at) || !['record_reversal', 'external_refund'].includes(String(row.kind))) throw invalid()
  if (row.kind === 'external_refund' ? typeof row.external_reference !== 'string' || !row.external_reference.trim() || !date(row.external_confirmed_at)
    : row.external_reference !== null || row.external_confirmed_at !== null) throw invalid()
  return row as Adjustment
}
export function readAdjustmentTotals(value: unknown): AdjustmentTotals {
  const row = object(value)
  if (!['record_reversal_kurus', 'record_reversal_count', 'external_refund_kurus', 'external_refund_count', 'reversal_cash_kurus', 'reversal_card_kurus', 'reversal_bank_kurus', 'refund_cash_kurus', 'refund_card_kurus', 'refund_bank_kurus'].every(key => money(row[key]))) throw invalid()
  for (const [total, prefix] of [['record_reversal_kurus', 'reversal'], ['external_refund_kurus', 'refund']]) {
    if (BigInt(Number(row[total])) !== ['cash', 'card', 'bank'].reduce((sum, method) => sum + BigInt(Number(row[`${prefix}_${method}_kurus`])), 0n)) throw invalid()
  }
  return row as AdjustmentTotals
}
export async function listAdjustments(filter: AdjustmentFilter) {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]))
  const row = object(await apiRequest(`/api/v1/financial-adjustments?${query}`)), page = object(row.pagination)
  if (!Array.isArray(row.data) || !['page', 'pageSize', 'total', 'totalPages'].every(key => money(page[key])) || page.page !== filter.page || page.pageSize !== filter.pageSize
    || row.data.length > filter.pageSize || page.totalPages !== Math.ceil(Number(page.total) / filter.pageSize)) throw invalid()
  return { data: row.data.map(readAdjustment), pagination: page as PageInfo }
}
export const adjustmentLabels = { record_reversal: 'Hatalı tahsilat ters kaydı', external_refund: 'Harici para iadesi' }
