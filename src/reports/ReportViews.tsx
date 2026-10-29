import { AdjustmentMetrics } from './AdjustmentMetrics'
import { AdjustmentHistory } from '../finance/AdjustmentHistory'
import { useCallback } from 'react'
import { ErrorState, HelpDisclosure, LoadingState } from '../components/ui'
import { getDebtReport, getEmployeesReport, getPaymentsReport, getSalesReport, type ReportFilter, type ReportItem, type ReportProduct } from '../services/reports'
import type { SaleSummary } from '../services/sales'
import { useResource } from '../hooks/useResource'
import { Pagination } from '../finance/Pagination'
import { formatMoney } from '../utils/format'
import { saleDate, methodLabels } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { customerHref } from '../customers/routing'
import { Metrics, RangeNote, ReportTable } from './ReportParts'
import { ReportFilters } from './ReportFilters'
import { reportsHref } from './routing'

export function PaymentsReport({ filter }: { filter: ReportFilter }) {
  const load = useCallback(() => getPaymentsReport(filter), [filter]), { result, retry } = useResource(JSON.stringify(filter), load)
  return <><p className="report-notice">Nakit tahsilat, fiziksel kasa bakiyesi değildir.</p>
    <ReportFilters mode="payments" filter={filter} retry={retry} />
    {!result ? <LoadingState label="Tahsilat raporu yükleniyor…" /> : result.error ? <ErrorState title="Tahsilat raporu yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      <RangeNote range={result.data.range} /><Metrics values={[
        { key: 'payments_total', label: 'Toplam tahsilat', value: result.data.summary.payments_total_kurus },
        { key: 'cash', label: 'Nakit Tahsilat', value: result.data.summary.cash_kurus }, { key: 'card', label: 'Kart tahsilatı', value: result.data.summary.card_kurus }, { key: 'bank', label: 'Banka tahsilatı', value: result.data.summary.bank_kurus },
      ]} /><AdjustmentMetrics totals={result.data.adjustments} methods />
      <HelpDisclosure title="Tahsilat raporunun kapsamı">
        <p>Nakit tahsilat, seçilen dönemde alınan geçerli nakit ödemelerdir. Açılış bakiyesi, kasa çıkışları ve sayım bulunmadığından fiziksel kasa bakiyesi değildir.</p>
        <p>Toplamlar seçili dönem ve varsa çalışanın tamamını kapsar.</p>
      </HelpDisclosure>
      <ReportTable rows={result.data.data} rowKey={row => row.id} label="Geçerli tahsilat hareketleri" columns={[
        { label: 'Tarih', cell: row => saleDate(row.created_at) }, { label: 'Müşteri', cell: row => <a className="text-link" href={customerHref(row.customer_id)}>{row.customer_name}</a> },
        { label: 'Tutar', cell: row => <span className="money">{formatMoney(row.amount_kurus)}</span> }, { label: 'Yöntem', cell: row => methodLabels[row.method] },
        { label: 'Tahsil eden', cell: row => row.created_by_username }, { label: 'Satış', cell: row => row.sale_id ? <a className="text-link" href={saleHref(row.sale_id)}>Satış detayı</a> : 'Satışa bağlı değil' },
      ]} /><Pagination page={result.data.pagination} label="Tahsilat raporu sayfaları" onPage={page => { window.location.hash = reportsHref('payments', { ...filter, page }) }} />
      <AdjustmentHistory key={JSON.stringify([result.data.range, filter.created_by])} filter={{ from: result.data.range.from, to: result.data.range.to, created_by: filter.created_by }} />
    </>}
  </>
}
export function SalesReport({ filter }: { filter: ReportFilter }) {
  const load = useCallback(() => getSalesReport(filter), [filter]), { result, retry } = useResource(JSON.stringify(filter), load)
  return <><ReportFilters mode="sales" filter={filter} retry={retry} />
    {!result ? <LoadingState label="Satış raporu yükleniyor…" /> : result.error ? <ErrorState title="Satış raporu yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      <RangeNote range={result.data.range} /><Metrics values={[
        { key: 'sales_total', label: 'Geçerli satış toplamı', value: result.data.summary.sales_total_kurus }, { key: 'sales_count', label: 'Geçerli satış adedi', value: result.data.summary.sales_count, money: false },
        { key: 'cancelled_total', label: 'İptal edilen satış toplamı', value: result.data.summary.cancelled_total_kurus }, { key: 'cancelled_count', label: 'İptal edilen satış adedi', value: result.data.summary.cancelled_count, money: false },
      ]} /><p className="report-help">Arama yalnızca listeyi filtreler.</p><HelpDisclosure title="Satış raporunun kapsamı">
        <p>Toplamlar seçili dönem ve varsa çalışanın tamamını kapsar; arama listeyi filtreler.</p>
        <p>İptaller satışın oluşturulma döneminde ayrı gösterilir. Ürün adları ve fiyatları satış anındaki kayıtlardır.</p>
      </HelpDisclosure>
      {filter.view === 'products' ? <ReportTable rows={result.data.data as ReportProduct[]} rowKey={row => JSON.stringify([row.product_id, row.product_name_snapshot, row.unit_price_kurus])} label="Ürün bazlı satışlar" columns={[
        { label: 'Satış anındaki ürün', cell: row => row.product_name_snapshot }, { label: 'Birim fiyat', cell: row => <span className="money">{formatMoney(row.unit_price_kurus)}</span> },
        { label: 'Miktar', cell: row => row.quantity }, { label: 'Satış tutarı', cell: row => <span className="money">{formatMoney(row.total_kurus)}</span> },
      ]} /> : filter.view === 'items' ? <ReportTable rows={result.data.data as ReportItem[]} rowKey={row => row.id} label="Satış kalemleri" columns={[
        { label: 'Ürün / satış', cell: row => <><strong>{row.product_name_snapshot}</strong><a className="text-link" href={saleHref(row.sale_id)}>Satış detayı</a></> },
        { label: 'Müşteri', cell: row => row.customer_name }, { label: 'Birim fiyat', cell: row => <span className="money">{formatMoney(row.unit_price_kurus)}</span> },
        { label: 'Miktar', cell: row => row.quantity }, { label: 'Kalem tutarı', cell: row => <span className="money">{formatMoney(row.line_total_kurus)}</span> },
        { label: 'Çalışan / tarih', cell: row => <>{row.created_by_username}<small>{saleDate(row.created_at)}</small></> },
      ]} /> : <ReportTable rows={result.data.data as SaleSummary[]} rowKey={row => row.id} label={filter.view === 'cancelled' ? 'İptal edilen satışlar' : 'Geçerli satışlar'} columns={[
        { label: 'Müşteri / satış', cell: row => <a className="text-link" href={saleHref(row.id)}>{row.customer_name}</a> }, { label: 'Tarih', cell: row => saleDate(row.created_at) },
        { label: 'Satış toplamı', cell: row => <span className="money">{formatMoney(row.total_kurus)}</span> }, { label: 'Çalışan', cell: row => row.created_by_username },
        { label: 'Durum', cell: row => row.status === 'cancelled' ? 'İptal edildi' : 'Tamamlandı' },
      ]} />}
      <Pagination page={result.data.pagination} label="Satış raporu sayfaları" onPage={page => { window.location.hash = reportsHref('sales', { ...filter, page }) }} />
    </>}
  </>
}
export function DebtReport({ filter }: { filter: ReportFilter }) {
  const load = useCallback(() => getDebtReport(filter), [filter]), { result, retry } = useResource(JSON.stringify(filter), load)
  return <><ReportFilters mode="receivables" filter={filter} retry={retry} />
    {!result ? <LoadingState label="Borç raporu yükleniyor…" /> : result.error ? <ErrorState title="Borç raporu yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      <RangeNote range={result.data.range} current /><Metrics values={[
        { key: 'open_debt', label: 'Toplam açık borç', value: result.data.summary.total_debt_kurus }, { key: 'debtors', label: 'Borçlu müşteri', value: result.data.summary.debtor_count, money: false },
        { key: 'open_sales', label: 'Açık satış', value: result.data.summary.open_sales_count, money: false },
      ]} /><p className="report-help">Güncel açık borç gösterilir; arama yalnızca listeyi filtreler.</p><HelpDisclosure title="Borç raporunun kapsamı">
        <p>Toplamlar tüm müşterilerin güncel açık borcudur; arama listeyi filtreler.</p>
        <p>Satış ve ödeme sütunları yalnızca açık satışları kapsar. Vade bilgisi bulunmuyor.</p>
      </HelpDisclosure>
      <ReportTable rows={result.data.data} rowKey={row => row.id} label="Müşteri bazlı açık borçlar" columns={[
        { label: 'Müşteri', cell: row => <a className="text-link" href={customerHref(row.id)}>{row.name}</a> }, { label: 'Açık satış', cell: row => row.open_sales_count },
        { label: 'Açık satış toplamı', cell: row => <span className="money">{formatMoney(row.sales_total_kurus)}</span> }, { label: 'Geçerli ödemeler', cell: row => <span className="money">{formatMoney(row.paid_kurus)}</span> },
        { label: 'Kalan borç', cell: row => <span className="money">{formatMoney(row.total_debt_kurus)}</span> },
      ]} /><Pagination page={result.data.pagination} label="Borç raporu sayfaları" onPage={page => { window.location.hash = reportsHref('receivables', { ...filter, page }) }} />
    </>}
  </>
}
export function EmployeesReport({ filter }: { filter: ReportFilter }) {
  const load = useCallback(() => getEmployeesReport(filter), [filter]), { result, retry } = useResource(JSON.stringify(filter), load)
  return <><HelpDisclosure title="Çalışan raporunun kapsamı">
    <p>Satış oluşturan ve tahsil eden kullanıcı ayrı hesaplanır. Seçili dönemde hareketi bulunan kullanıcılar gösterilir.</p>
  </HelpDisclosure><ReportFilters mode="employees" filter={filter} retry={retry} />
    {!result ? <LoadingState label="Çalışan raporu yükleniyor…" /> : result.error ? <ErrorState title="Çalışan raporu yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      <RangeNote range={result.data.range} /><ReportTable rows={result.data.data} rowKey={row => row.id} label="Çalışan bazlı satış ve tahsilat" columns={[
        { label: 'Çalışan / hareketler', cell: row => <><strong>{row.username}</strong><a className="text-link" href={reportsHref('sales', { ...filter, q: undefined, view: 'sales', created_by: row.id, page: 1 })}>Satış hareketleri</a>
          <a className="text-link" href={reportsHref('payments', { ...filter, q: undefined, created_by: row.id, page: 1 })}>Tahsilat hareketleri</a></> },
        { label: 'Satış adedi', cell: row => row.sales_count }, { label: 'Satış toplamı', cell: row => <span className="money">{formatMoney(row.sales_total_kurus)}</span> },
        { label: 'Tahsilat toplamı', cell: row => <span className="money">{formatMoney(row.payments_total_kurus)}</span> },
        { label: 'Uyguladığı ters kayıt / harici iade', cell: row => <><span className="money">{formatMoney(row.record_reversal_kurus)} / {formatMoney(row.external_refund_kurus)}</span><small>Ters: nakit {formatMoney(row.reversal_cash_kurus)} · kart {formatMoney(row.reversal_card_kurus)} · banka {formatMoney(row.reversal_bank_kurus)}</small><small>İade: nakit {formatMoney(row.refund_cash_kurus)} · kart {formatMoney(row.refund_card_kurus)} · banka {formatMoney(row.refund_bank_kurus)}</small></> },
        { label: 'Nakit / kart / banka', cell: row => <><span className="money">Nakit: {formatMoney(row.cash_kurus)}</span><span className="money">Kart: {formatMoney(row.card_kurus)}</span><span className="money">Banka: {formatMoney(row.bank_kurus)}</span></> },
      ]} /><Pagination page={result.data.pagination} label="Çalışan raporu sayfaları" onPage={page => { window.location.hash = reportsHref('employees', { ...filter, page }) }} />
    </>}
  </>
}
