import { useSyncExternalStore } from 'react'
import type { IconName } from '../components/ui/Icon'
import type { Role } from '../services/auth'

export type PageId = 'overview' | 'customers' | 'sales' | 'payments' | 'credit' | 'products' | 'menu'
type NavigationItem = { id: PageId; label: string; href: string; icon: IconName; roles?: readonly Role[] }

export const navigation: NavigationItem[] = [
  { id: 'overview', label: 'Genel Bakış', href: '#/genel-bakis', icon: 'overview' },
  { id: 'customers', label: 'Müşteriler', href: '#/musteriler', icon: 'customers' },
  { id: 'sales', label: 'Satışlar', href: '#/yeni-satis', icon: 'sales' },
  { id: 'payments', label: 'Tahsilatlar', href: '#/tahsilatlar', icon: 'payments' },
  { id: 'credit', label: 'Veresiye', href: '#/veresiye', icon: 'credit' },
  { id: 'products', label: 'Ürünler', href: '#/urunler', icon: 'products' },
]

export const menuItem: NavigationItem = { id: 'menu', label: 'Menü', href: '#/menu', icon: 'menu' }

// Optional roles prepare future UI restrictions; server authorization remains authoritative.
export function navigationForRole(role: Role) {
  return navigation.filter(item => !item.roles || item.roles.includes(role))
}

export function canAccessPage(page: PageId | 'not-found', role: Role) {
  if (page === 'menu' || page === 'not-found') return true
  return navigationForRole(role).some(item => item.id === page)
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function getSnapshot(): PageId | 'not-found' {
  const hash = window.location.hash.replace(/\/$/, '')
  if (!hash || hash === '#') return 'overview'
  return [...navigation, menuItem].find(item => item.href === hash)?.id ?? 'not-found'
}

export function usePage() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
