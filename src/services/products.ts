import { ApiError, apiRequest } from './apiClient'

export type Product = { id: string; name: string; current_price_kurus: number; is_active: boolean; created_at: string; updated_at: string }
export type ProductInput = Pick<Product, 'name' | 'current_price_kurus' | 'is_active'>
export type ProductPatch = Partial<ProductInput>
export type ProductFilter = { q: string; status: 'all' | 'active' | 'inactive'; page: number; pageSize: number }
export type ProductList = { data: Product[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Ürün verileri doğrulanamadı. Lütfen tekrar deneyin.')

function readProduct(value: unknown): Product {
  if (!value || typeof value !== 'object') throw invalid()
  const data = value as Record<string, unknown>
  if (typeof data.id !== 'string' || typeof data.name !== 'string'
    || typeof data.current_price_kurus !== 'number' || !Number.isSafeInteger(data.current_price_kurus) || data.current_price_kurus < 0
    || typeof data.is_active !== 'boolean' || typeof data.created_at !== 'string' || !Number.isFinite(Date.parse(data.created_at))
    || typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at))) throw invalid()
  return { id: data.id, name: data.name, current_price_kurus: data.current_price_kurus, is_active: data.is_active,
    created_at: data.created_at, updated_at: data.updated_at }
}
function readSingle(value: unknown) {
  if (!value || typeof value !== 'object' || !('data' in value)) throw invalid()
  return readProduct(value.data)
}
export async function listProducts(filter: ProductFilter): Promise<ProductList> {
  const query = new URLSearchParams({ q: filter.q, status: filter.status, page: String(filter.page), pageSize: String(filter.pageSize) })
  const result = await apiRequest(`/api/v1/products?${query}`)
  if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data)
    || !('pagination' in result) || !result.pagination || typeof result.pagination !== 'object') throw invalid()
  const page = result.pagination as Record<string, unknown>
  if (!['page', 'pageSize', 'total', 'totalPages'].every(field => typeof page[field] === 'number' && Number.isSafeInteger(page[field]) && Number(page[field]) >= 0)
    || page.page !== filter.page || page.pageSize !== filter.pageSize || result.data.length > filter.pageSize
    || Number(page.totalPages) !== Math.ceil(Number(page.total) / filter.pageSize)) throw invalid()
  return { data: result.data.map(readProduct), pagination: page as ProductList['pagination'] }
}
export const getProduct = async (id: string) => readSingle(await apiRequest(`/api/v1/products/${encodeURIComponent(id)}`))
export const createProduct = async (body: ProductInput, key: string) => readSingle(await apiRequest('/api/v1/products', { method: 'POST', body, idempotencyKey: key }))
export const updateProduct = async (id: string, body: ProductPatch) => readSingle(await apiRequest(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'PATCH', body }))
