import { useEffect, useMemo } from 'react'
import { ErrorState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import type { Role } from '../services/auth'
import { DebtReport, EmployeesReport, PaymentsReport, SalesReport } from './ReportViews'
import { parseReportLocation, reportLabels, reportsHref, useReportLocation, type ReportMode } from './routing'
import '../finance/finance.css'
import './reports.css'

export function ReportsPage({ role }: { role: Role }) {
  const hash = useReportLocation(), { mode, filter, invalid } = useMemo(() => parseReportLocation(hash), [hash])
  const allowed = (mode !== 'employees' && !filter.created_by) || role === 'admin'
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [hash])
  return <div className="reports-page"><PageHeader title={reportLabels[mode]} description="Satış, tahsilat ve güncel açık borç ayrı kaynaklardan hesaplanır." />
    <nav className="report-tabs" aria-label="Finansal raporlar">{(Object.keys(reportLabels) as ReportMode[]).filter(key => key !== 'employees' || role === 'admin').map(key => <a key={key}
      aria-current={mode === key ? 'page' : undefined} href={reportsHref(key, { period: filter.period, from: filter.from, to: filter.to })}>{reportLabels[key]}</a>)}</nav>
    {!allowed ? <ErrorState title="Yönetici yetkisi gerekli" description="Çalışan bazlı yönetim raporlarına yalnızca admin erişebilir." />
      : invalid ? <ErrorState title="Rapor filtreleri geçersiz" description="Dönem, tarih ve sayfa değerlerini kontrol edin." />
        : mode === 'payments' ? <PaymentsReport key={hash} filter={filter} /> : mode === 'sales' ? <SalesReport key={hash} filter={filter} />
          : mode === 'receivables' ? <DebtReport key={hash} filter={filter} /> : <EmployeesReport key={hash} filter={filter} />}
  </div>
}
