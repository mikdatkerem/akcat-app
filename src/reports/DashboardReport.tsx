import { useCallback } from 'react'
import { Button, Card, EmptyState, ErrorState, HelpDisclosure, LoadingState } from '../components/ui'
import { getSummaryReport } from '../services/reports'
import { useResource } from '../hooks/useResource'
import { Metrics, ReportTable } from './ReportParts'
import { formatMoney } from '../utils/format'
import { saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { customerHref } from '../customers/routing'
import './reports.css'

export function DashboardReport() {
  const load = useCallback(() => getSummaryReport(), []), { result, retry } = useResource('dashboard:today', load)
  return <section className="dashboard-report" aria-label="Güncel finansal özet">
    <div className="report-section-heading"><h2>Bugünkü işletme özeti</h2><Button variant="secondary" onClick={retry}>Özeti Yenile</Button></div>
    {!result ? <LoadingState label="İşletme özeti yükleniyor…" /> : result.error ? <ErrorState title="İşletme özeti yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      <div className="report-range"><p>Rapor zamanı: <time dateTime={result.data.range.generated_at}>{saleDate(result.data.range.generated_at)}</time></p></div>
      <Metrics values={[
        { key: 'today_sales', label: 'Bugünkü satış toplamı', value: result.data.sales.sales_total_kurus }, { key: 'today_payments', label: 'Bugünkü tahsilat toplamı', value: result.data.payments.payments_total_kurus },
        { key: 'today_cash', label: 'Bugünkü Nakit Tahsilat', value: result.data.payments.cash_kurus }, { key: 'current_debt', label: 'Güncel açık müşteri borcu', value: result.data.receivables.total_debt_kurus },
        { key: 'today_count', label: 'Bugünkü satış adedi', value: result.data.sales.sales_count, money: false },
      ]} />
      <HelpDisclosure title="Özet nasıl hesaplanır?">
        <p>Açık borç tüm tarihlerdeki açık satışları kapsar.</p>
        <p>Satış ve tahsilat kendi işlem tarihlerine göre hesaplanır.</p>
        <p>Nakit tahsilat fiziksel kasa bakiyesi değildir.</p>
      </HelpDisclosure>
      <div className="report-section-heading"><h2>Bugünkü son işlemler</h2><a className="text-link" href="#/raporlar">Raporları görüntüle</a></div>
      <p className="report-help">Bugünün son 10 işlemi. Önceki kayıtlar için raporları kullanın.</p>
      {result.data.recent.length === 0 ? <Card title="Bugünkü işlem geçmişi"><EmptyState title="Henüz işlem bulunmuyor." description="Bugün kayıtlı hareket yok. Önceki günlerdeki işlemler raporlarda görüntülenebilir." /></Card> : <ReportTable rows={result.data.recent} rowKey={row => row.id} label="Bugünkü son işlemler" columns={[
        { label: 'İşlem türü', cell: row => row.type === 'record_reversal' ? 'Hatalı tahsilat ters kaydı' : row.type === 'external_refund' ? 'Harici para iadesi' : row.type === 'payment' ? 'Tahsilat' : row.type === 'cancellation' ? 'Satış iptali' : row.status === 'cancelled' ? 'Satış (iptal edildi)' : 'Satış' },
        { label: 'Müşteri', cell: row => <a className="text-link" href={row.sale_id ? saleHref(row.sale_id) : customerHref(row.customer_id)}>{row.customer_name}</a> },
        { label: 'Tutar', cell: row => <span className="money">{formatMoney(row.amount_kurus)}</span> }, { label: 'İşlemi yapan', cell: row => row.created_by_username }, { label: 'Tarih', cell: row => saleDate(row.created_at) },
      ]} />}
    </>}
  </section>
}
