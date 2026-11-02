import { ApiHealth } from '../components/ApiHealth'
import { Icon } from '../components/ui'
import { DashboardReport } from '../reports/DashboardReport'
import { navigationForRole } from '../layout/navigation'
import type { Role } from '../services/auth'
import { PageHeader } from './PageHeader'
import './overview.css'

export function OverviewPage({ role }: { role: Role }) {
  return (
    <>
      <PageHeader title="Genel Bakış" description="Satış, tahsilat ve veresiye durumunu tek yerden takip edin." />
      <section className="overview-welcome" aria-labelledby="overview-welcome-title">
        <div className="overview-welcome__content">
          <div className="overview-welcome__copy">
            <p className="overview-welcome__eyebrow">AKÇAT DOĞAL MİNERALLİ SU</p>
            <h2 id="overview-welcome-title">Doğal kaynaktan<br />mutfaklarınıza</h2>
            <p>pH 9,18 değerine sahip, ozonsuz, doğal mineralli su.<br />Sağlıklı yaşamın doğal seçimi.</p>
          </div>
          <div className="overview-welcome__actions">
            <a className="ui-button ui-button--primary" href="#/yeni-satis?mode=normal"><Icon name="plus" width="18" height="18" />Yeni Satış</a>
            <a className="ui-button ui-button--secondary" href="#/yeni-satis?mode=walk_in"><Icon name="bolt" width="18" height="18" />Hızlı Satış</a>
          </div>
        </div>
      </section>
      {role === 'admin' && <DashboardReport />}
      {role === 'admin' && <ApiHealth />}
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
