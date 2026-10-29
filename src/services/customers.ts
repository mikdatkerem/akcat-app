import { ApiError, apiRequest } from './apiClient'

export type Customer = { id: string; name: string; phone: string | null; address: string; delivery_notes: string | null;
  is_active: boolean; created_at: string; updated_at: string }
export type CustomerInput = Pick<Customer, 'name' | 'phone' | 'address' | 'delivery_notes'>
export type CustomerPatch = Partial<CustomerInput & Pick<Customer, 'is_active'>>
export type CustomerFilter = { q: string; status: 'all' | 'active' | 'inactive'; page: number; pageSize: number }
export type CustomerList = { data: Customer[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Müşteri verileri doğrulanamadı. Lütfen tekrar deneyin.')

function readCustomer(value: unknown): Customer {
  if (!value || typeof value !== 'object') throw invalid()
  const data = value as Record<string, unknown>
  if (typeof data.id !== 'string' || typeof data.name !== 'string' || typeof data.address !== 'string'
    || (data.phone !== null && typeof data.phone !== 'string') || (data.delivery_notes !== null && typeof data.delivery_notes !== 'string')
    || typeof data.is_active !== 'boolean' || typeof data.created_at !== 'string' || !Number.isFinite(Date.parse(data.created_at))
    || typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at))) throw invalid()
  return { id: data.id, name: data.name, phone: data.phone, address: data.address, delivery_notes: data.delivery_notes,
    is_active: data.is_active, created_at: data.created_at, updated_at: data.updated_at } as Customer
}
function readSingle(value: unknown) {
  if (!value || typeof value !== 'object' || !('data' in value)) throw invalid()
  return readCustomer(value.data)
}
export async function listCustomers(filter: CustomerFilter): Promise<CustomerList> {
  const query = new URLSearchParams({ q: filter.q, status: filter.status, page: String(filter.page), pageSize: String(filter.pageSize) })
  const result = await apiRequest(`/api/v1/customers?${query}`)
  if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data)
    || !('pagination' in result) || !result.pagination || typeof result.pagination !== 'object') throw invalid()
  const page = result.pagination as Record<string, unknown>
  if (!['page', 'pageSize', 'total', 'totalPages'].every(field => typeof page[field] === 'number' && Number.isSafeInteger(page[field]) && Number(page[field]) >= 0)
    || page.page !== filter.page || page.pageSize !== filter.pageSize || result.data.length > filter.pageSize) throw invalid()
  return { data: result.data.map(readCustomer), pagination: page as CustomerList['pagination'] }
}
export const getCustomer = async (id: string) => readSingle(await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}`))
export const createCustomer = async (body: CustomerInput, key: string) => readSingle(await apiRequest('/api/v1/customers', { method: 'POST', body, idempotencyKey: key }))
export const updateCustomer = async (id: string, body: CustomerPatch) => readSingle(await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body }))
export async function deleteCustomer(id: string, key: string): Promise<void> {
  const result = await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'DELETE', idempotencyKey: key })
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true
    || !('id' in result) || result.id !== id) throw invalid()
}
