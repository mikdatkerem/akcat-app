import { useSyncExternalStore } from 'react'
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback) }
export const useFinanceLocation = () => useSyncExternalStore(subscribe, () => window.location.hash)
export function paymentHref(customerId?: string, saleId?: string) {
  const query = new URLSearchParams()
  if (customerId) query.set('customer_id', customerId)
  if (saleId) query.set('sale_id', saleId)
  return '#/tahsilatlar/yeni' + (query.size ? '?' + query : '')
}
