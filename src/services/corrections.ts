import { ApiError, apiRequest } from './apiClient'
import { readSale, type Sale } from './sales'
import type { PageInfo } from './finance'
export type CorrectionType = 'sale_cancel' | 'sale_customer' | 'sale_items' | 'sale_error' | 'payment_amount' | 'payment_method'
export type CorrectionInput = { target_type: 'sale' | 'payment'; target_id: string; correction_type: CorrectionType; reason: string; requested_change: string }
export type Correction = Omit<CorrectionInput, 'correction_type'> & { id: string; correction_type: CorrectionType | 'legacy'; requested_by: string; requested_by_username: string;
  status: 'pending' | 'approved' | 'rejected'; reviewed_by: string | null; reviewed_by_username: string | null; reviewed_at: string | null; created_at: string;
  can_approve: boolean; approval_explanation: string;
  history: { action: string; actor_user_id: string; username: string; created_at: string; metadata: { reason: string; before: unknown; after: unknown } }[] }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Düzeltme yanıtı doğrulanamadı. Tekrar denemeden önce talep geçmişini kontrol edin.')
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object') throw invalid(); return value as Record<string, unknown> }
function correction(value: unknown): Correction {
  const row = object(value)
  if (!['id', 'target_id', 'requested_by', 'requested_by_username', 'reason', 'requested_change', 'correction_type', 'approval_explanation'].every(key => typeof row[key] === 'string')
    || !['sale', 'payment'].includes(String(row.target_type)) || !['pending', 'approved', 'rejected'].includes(String(row.status))
    || typeof row.can_approve !== 'boolean' || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
    || !['reviewed_by', 'reviewed_by_username', 'reviewed_at'].every(key => row[key] === null || typeof row[key] === 'string') || !Array.isArray(row.history)) throw invalid()
  for (const item of row.history) {
    const log = object(item), meta = object(log.metadata)
    if (!['action', 'actor_user_id', 'username', 'created_at'].every(key => typeof log[key] === 'string') || typeof meta.reason !== 'string') throw invalid()
  }
  return row as Correction
}
export const getCorrection = async (id: string) => correction(object(await apiRequest(`/api/v1/correction-requests/${encodeURIComponent(id)}`)).data)
export async function listCorrections(status: string, page: number) {
  const row = object(await apiRequest(`/api/v1/correction-requests?status=${encodeURIComponent(status)}&page=${page}&pageSize=20`)), info = object(row.pagination)
  if (!Array.isArray(row.data) || !['page', 'pageSize', 'total', 'totalPages'].every(key => Number.isSafeInteger(info[key]) && Number(info[key]) >= 0)
    || info.page !== page || info.pageSize !== 20 || info.totalPages !== Math.ceil(Number(info.total) / 20)) throw invalid()
  return { data: row.data.map(correction), pagination: info as PageInfo }
}
export async function createCorrection(body: CorrectionInput, key: string) { return correction(object(await apiRequest('/api/v1/correction-requests', { method: 'POST', body, idempotencyKey: key })).data) }
export async function reviewCorrection(id: string, action: 'approve' | 'reject', body: { reason: string }, key: string) {
  return correction(object(await apiRequest(`/api/v1/correction-requests/${encodeURIComponent(id)}/${action}`, { method: 'POST', body, idempotencyKey: key })).data)
}
export async function cancelSale(id: string, body: { reason: string }, key: string): Promise<Sale> {
  return readSale(await apiRequest(`/api/v1/sales/${encodeURIComponent(id)}/cancel`, { method: 'POST', body, idempotencyKey: key }))
}
export const correctionHref = (type: 'sale' | 'payment', id: string) => `#/duzeltmeler/yeni?target_type=${type}&target_id=${encodeURIComponent(id)}`
