import { useSyncExternalStore } from 'react'
import type { ProductFilter } from '../services/products'

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
export const useProductLocation = () => useSyncExternalStore(subscribe, () => window.location.hash)
export const productHref = (id: string) => `#/urunler/${encodeURIComponent(id)}`
export function productListHref(q: string, status: ProductFilter['status'], page: number, pageSize: number) {
  return `#/urunler?${new URLSearchParams({ q, status, page: String(page), pageSize: String(pageSize) })}`
}
