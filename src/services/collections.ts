import { apiRequest, ApiError } from './apiClient'
import { readPayment, type Payment } from './finance'
import type { PaymentMethod } from './sales'
export type CollectionInput = { customer_id: string; amount_kurus: number; method: PaymentMethod; expected_balance_version?: string }
export type CollectionPreview = { customer: { id: string; name: string }; total_debt_kurus: number; remaining_debt_kurus: number; balance_version: string;
  allocations: { sale_id: string; created_at: string; before_kurus: number; amount_kurus: number; after_kurus: number }[] }
export type Collection = { id: string; customer_id: string; amount_kurus: number; method: PaymentMethod; created_by: string; created_by_username: string; created_at: string; allocations: Payment[] }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Tahsilat dağılımı doğrulanamadı. Aynı işlemi tekrar deneyin.')
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object') throw invalid(); return v as Record<string, unknown> }
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
export async function previewCollection(input: CollectionInput): Promise<CollectionPreview> {
  const v = object(await apiRequest('/api/v1/payments/collections/preview', { method: 'POST', body: input })), c = object(v.customer)
  if (c.id !== input.customer_id || typeof c.name !== 'string' || !money(v.total_debt_kurus) || !money(v.remaining_debt_kurus)
    || v.total_debt_kurus - input.amount_kurus !== v.remaining_debt_kurus || typeof v.balance_version !== 'string' || !/^[a-f0-9]{64}$/.test(v.balance_version)
    || !Array.isArray(v.allocations) || !v.allocations.length) throw invalid()
  let sum = 0n
  for (const value of v.allocations) {
    const row = object(value)
    if (typeof row.sale_id !== 'string' || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
      || !money(row.before_kurus) || !money(row.after_kurus) || !money(row.amount_kurus) || row.amount_kurus <= 0
      || row.before_kurus - row.amount_kurus !== row.after_kurus) throw invalid()
    sum += BigInt(row.amount_kurus)
  }
  if (sum !== BigInt(input.amount_kurus)) throw invalid()
  return v as CollectionPreview
}
function read(value: unknown): Collection {
  const v = object(object(value).data)
  if (!['id', 'customer_id', 'created_by', 'created_by_username', 'created_at'].every(k => typeof v[k] === 'string')
    || !Number.isFinite(Date.parse(String(v.created_at))) || !money(v.amount_kurus) || v.amount_kurus <= 0
    || !['cash', 'card', 'bank'].includes(String(v.method)) || !Array.isArray(v.allocations) || !v.allocations.length) throw invalid()
  const allocations = v.allocations.map(readPayment)
  if (allocations.some(p => p.collection_id !== v.id || p.customer_id !== v.customer_id || p.method !== v.method)
    || allocations.reduce((s, p) => s + BigInt(p.amount_kurus), 0n) !== BigInt(v.amount_kurus)) throw invalid()
  return { ...v, allocations } as Collection
}
export const createCollection = async (body: CollectionInput, key: string) => read(await apiRequest('/api/v1/payments/collections', { method: 'POST', body, idempotencyKey: key }))
export const getCollection = async (id: string) => read(await apiRequest(`/api/v1/payments/collections/${encodeURIComponent(id)}`))
