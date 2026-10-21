import { Icon } from '../components/ui'
import { navigationForRole, type PageId } from './navigation'
import type { Role } from '../services/auth'

export function NavigationLinks({ page, label, role, onNavigate }: {
  page: PageId | 'not-found'
  label: string
  role: Role
  onNavigate?: () => void
}) {
  return (
    <nav className="sidebar-navigation" aria-label={label}>
      {navigationForRole(role).map(item => (
        <a key={item.id} href={item.href} className="sidebar-link" onClick={onNavigate}
          aria-current={page === item.id ? 'page' : undefined}>
          <Icon name={item.icon} /><span>{item.label}</span>
          {page === item.id && <span className="sidebar-link__indicator" aria-hidden="true" />}
        </a>
      ))}
    </nav>
  )
}
