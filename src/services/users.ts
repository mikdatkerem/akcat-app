import { ApiError, apiRequest } from './apiClient'
import type { Role } from './auth'
import type { PageInfo } from './finance'
export type ManagedUser = { id: string; username: string; role: Role; is_active: boolean; created_at: string; updated_at: string }
export type UserInput = { username: string; password: string; role: Role }
export type UserPatch = Partial<Pick<ManagedUser, 'username' | 'role' | 'is_active'>>
export type UserFilter = { q: string; status: 'all' | 'active' | 'inactive'; page: number; pageSize: number }
const invalid = () => new ApiError(0, 'INVALID_RESPONSE', 'Hesap bilgileri doğrulanamadı. Kullanıcıyı yeniden yükleyin.')
function read(value: unknown): ManagedUser {
  if (!value || typeof value !== 'object') throw invalid()
  const row = value as Record<string, unknown>
  if (!['id', 'username', 'created_at', 'updated_at'].every(key => typeof row[key] === 'string') || !['admin', 'employee'].includes(String(row.role))
    || typeof row.is_active !== 'boolean' || !Number.isFinite(Date.parse(String(row.created_at))) || !Number.isFinite(Date.parse(String(row.updated_at)))) throw invalid()
  return { id: String(row.id), username: String(row.username), role: row.role as Role, is_active: row.is_active, created_at: String(row.created_at), updated_at: String(row.updated_at) }
}
function single(value: unknown) { if (!value || typeof value !== 'object' || !('data' in value)) throw invalid(); return read(value.data) }
export async function listUsers(filter: UserFilter): Promise<{ data: ManagedUser[]; pagination: PageInfo }> {
  const query = new URLSearchParams(Object.entries(filter).map(([key, value]) => [key, String(value)]))
  const value = await apiRequest(`/api/v1/users?${query}`)
  if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data) || !('pagination' in value) || !value.pagination || typeof value.pagination !== 'object') throw invalid()
  const page = value.pagination as Record<string, unknown>
  if (!['page', 'pageSize', 'total', 'totalPages'].every(key => Number.isSafeInteger(page[key]) && Number(page[key]) >= 0)
    || page.page !== filter.page || page.pageSize !== filter.pageSize || page.totalPages !== Math.ceil(Number(page.total) / filter.pageSize) || value.data.length > filter.pageSize) throw invalid()
  return { data: value.data.map(read), pagination: page as PageInfo }
}
export const getUser = async (id: string) => single(await apiRequest(`/api/v1/users/${encodeURIComponent(id)}`))
export const createUser = async (body: UserInput, key: string) => single(await apiRequest('/api/v1/users', { method: 'POST', body, idempotencyKey: key }))
export const updateUser = async (id: string, body: UserPatch, key: string) => single(await apiRequest(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'PATCH', body, idempotencyKey: key }))
export const resetUserPassword = async (id: string, password: string, key: string) => single(await apiRequest(`/api/v1/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: { password }, idempotencyKey: key }))
