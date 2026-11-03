import { apiRequest, ApiError } from './apiClient'
export type Vouchers = { customer_id: string; available_quantity: number; data: { id: string; sale_id: string; movement_type: 'purchase' | 'redemption' | 'purchase_reversal' | 'redemption_reversal'; quantity: number; balance_after: number; created_at: string; created_by_username: string }[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
export async function getVouchers(id: string, page = 1): Promise<Vouchers> {
 const value = await apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/vouchers?page=${page}&pageSize=20`) as Vouchers
 if (!value || value.customer_id !== id || !Number.isSafeInteger(value.available_quantity) || value.available_quantity < 0 || !Array.isArray(value.data)
  || !value.pagination || value.pagination.page !== page || !['pageSize','total','totalPages'].every(key => Number.isSafeInteger(value.pagination[key as keyof Vouchers['pagination']]) && value.pagination[key as keyof Vouchers['pagination']] >= 0)
  || value.data.some(row => !['purchase','redemption','purchase_reversal','redemption_reversal'].includes(row.movement_type) || !Number.isSafeInteger(row.quantity) || !Number.isSafeInteger(row.balance_after) || row.balance_after < 0 || typeof row.sale_id !== 'string' || typeof row.created_by_username !== 'string' || !Number.isFinite(Date.parse(row.created_at)))) throw new ApiError(0,'INVALID_RESPONSE','Su fişi bilgileri doğrulanamadı.')
 return value
}
export const voucherLabels = { purchase: 'Fiş satışı', redemption: 'Damacana teslimatı', purchase_reversal: 'Fiş satışı ters kaydı / iade', redemption_reversal: 'Teslimat iptali' }
