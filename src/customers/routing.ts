import { useSyncExternalStore } from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
export function useCustomerLocation() {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}
export const customerHref = (id: string) => `#/musteriler/${encodeURIComponent(id)}`
export function customerListHref(q = '', status = 'all', page = 1, pageSize = 20) {
  return '#/musteriler?' + new URLSearchParams({ q, status, page: String(page), pageSize: String(pageSize) })
}
