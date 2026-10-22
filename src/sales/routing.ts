import { useSyncExternalStore } from 'react'
import type { SaleFilter } from '../services/sales'
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback) }
export const useSaleLocation = () => useSyncExternalStore(subscribe, () => window.location.hash)
export const saleHref = (id: string) => `#/satislar/${encodeURIComponent(id)}`
export function saleListHref(filter: SaleFilter) {
  const query = new URLSearchParams({ page: String(filter.page), pageSize: String(filter.pageSize) })
  for (const key of ['customer_id', 'from', 'to'] as const) if (filter[key]) query.set(key, filter[key])
  return `#/satislar?${query}`
}
