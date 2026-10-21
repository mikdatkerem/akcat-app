import { Icon } from '../components/ui'
import { navigationForRole } from '../layout/navigation'
import type { Role } from '../services/auth'
import { PageHeader } from './PageHeader'

export function MenuPage({ role }: { role: Role }) {
  return (
    <>
      <PageHeader title="Menü" description="Diğer çalışma alanlarına buradan ulaşın." />
      <nav className="secondary-navigation" aria-label="Diğer çalışma alanları">
        {navigationForRole(role).filter(item => ['credit', 'products'].includes(item.id)).map(item => (
          <a key={item.id} href={item.href} className="workspace-link">
            <span className="workspace-link__icon"><Icon name={item.icon} /></span>
            <span><strong>{item.label}</strong><small>{item.id === 'credit' ? 'Müşteri borçları ve hesap hareketleri' : 'Ürün bilgileri ve fiyatlar'}</small></span>
            <Icon name="arrow" width="18" height="18" />
          </a>
        ))}
      </nav>
    </>
  )
}
