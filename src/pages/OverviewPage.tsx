import { ApiHealth } from '../components/ApiHealth'
import { Badge, Card, EmptyState, Icon } from '../components/ui'
import { navigationForRole } from '../layout/navigation'
import type { Role } from '../services/auth'
import { PageHeader } from './PageHeader'

export function OverviewPage({ role }: { role: Role }) {
  return (
    <>
      <PageHeader title="Genel Bakış" description="Satış, tahsilat ve veresiye durumunu tek yerden takip edin." />
      <div className="overview-grid">
        <Card title="İşletme özeti" description="Satış, tahsilat ve açık borç bilgileri." accessory={<Badge tone="info">Veri bağlantısı bekleniyor</Badge>} className="overview-summary">
          <EmptyState icon="overview" title="Özet verileri henüz bağlı değil" description="Satış, tahsilat ve borç verileri bağlandığında işletmenizin güncel özeti burada gösterilecek." />
        </Card>
        <ApiHealth />
      </div>
      <section className="workspace-section" aria-labelledby="workspace-title">
        <div className="section-heading"><h2 id="workspace-title">Çalışma alanları</h2><p>İlgili alana geçerek başlayın.</p></div>
        <div className="workspace-links">
          {navigationForRole(role).filter(item => ['customers', 'sales', 'payments'].includes(item.id)).map(item => (
            <a key={item.id} href={item.id === 'sales' ? '#/yeni-satis' : item.href} className="workspace-link">
              <span className="workspace-link__icon"><Icon name={item.icon} /></span>
              <span><strong>{item.id === 'sales' ? 'Yeni Satış' : item.label}</strong><small>{item.id === 'customers' ? 'Müşteri kayıtları ve bilgileri' : item.id === 'sales' ? 'Satış kaydı çalışma alanı' : 'Ödeme ve tahsilat kayıtları'}</small></span>
              <Icon name="arrow" width="18" height="18" />
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
