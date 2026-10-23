import { useCallback, useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, ErrorState, Input, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listCustomers } from '../services/customers'
import { listSales, type SaleFilter } from '../services/sales'
import type { Role } from '../services/auth'
import { formatMoney } from '../utils/format'
import { useResource } from '../hooks/useResource'
import { RecordPicker } from './RecordPicker'
import { PaymentBadge } from './SaleRecord'
import { saleDate } from './presentation'
import { saleHref, saleListHref } from './routing'
import { customerHref } from '../customers/routing'

const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'all' })
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
export function SaleListPage({ filter, role }: { filter: SaleFilter; role: Role }) {
  const [customerId, setCustomerId] = useState(filter.customer_id)
  const [customerName, setCustomerName] = useState('')
  const [from, setFrom] = useState(filter.from ? day.format(new Date(filter.from)) : '')
  const [to, setTo] = useState(filter.to ? day.format(new Date(Date.parse(filter.to) - 1)) : '')
  const [error, setError] = useState('')
  const load = useCallback(() => listSales(filter), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  function apply(event: FormEvent) {
    event.preventDefault()
    if ([from, to].some(value => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00+03:00`))))) {
      setError('Geçerli bir tarih girin.'); return
    }
    if (from && to && from > to) { setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.'); return }
    const next: SaleFilter = { page: 1, pageSize: filter.pageSize, customer_id: customerId }
    if (from) next.from = new Date(`${from}T00:00:00+03:00`).toISOString()
    if (to) next.to = new Date(Date.parse(`${to}T00:00:00+03:00`) + 86400000).toISOString()
    setError('')
    const href = saleListHref(next)
    if (window.location.hash === href) retry()
    window.location.hash = href
  }
  const list = result?.data
  return <>
    <PageHeader title="Satışlar" description={role === 'admin' ? 'Şirket satışları ve güncel ödeme durumları.' : 'Tüm çalışanların müşteri satışları ve güncel ödeme durumları.'}
      actions={<a className="ui-button ui-button--primary" href="#/yeni-satis">Yeni satış</a>} />
    <section className="sale-history-filters" aria-label="Satış filtreleri">
      <details><summary>Müşteriye göre filtrele{customerId ? ' · Seçili' : ''}</summary>
        <RecordPicker label="Müşteri filtresi ara" load={customers} describe={value => value.phone || value.address}
          onSelect={customer => { setCustomerId(customer.id); setCustomerName(customer.name) }} />
        {customerId && <div className="sale-selected"><p>{customerName || 'Müşteri filtresi seçili'}</p><Button variant="ghost" onClick={() => { setCustomerId(undefined); setCustomerName('') }}>Müşteri filtresini temizle</Button></div>}
      </details>
      <form className="sale-date-filters" onSubmit={apply}>
        <Input label="Başlangıç tarihi" type="date" min="0001-01-01" max="9999-12-30" value={from} onChange={event => setFrom(event.target.value)} />
        <Input label="Bitiş tarihi" type="date" min="0001-01-01" max="9999-12-30" value={to} onChange={event => setTo(event.target.value)} />
        <Button type="submit" variant="secondary">Filtrele</Button>
        <Button variant="ghost" onClick={() => { window.location.hash = '#/satislar'; if (!filter.customer_id && !filter.from && !filter.to && filter.page === 1) { setFrom(''); setTo(''); setCustomerId(undefined); setCustomerName(''); retry() } }}>Filtreleri temizle</Button>
      </form>
      {error && <p className="sale-validation" role="alert">{error}</p>}
    </section>
    {!result ? <LoadingState label="Satışlar yükleniyor…" /> : result.error ? <ErrorState title="Satışlar yüklenemedi" description={result.error} onRetry={retry} /> : list && <>
      {list.data.length === 0 ? <Card title="Satış geçmişi"><EmptyState icon="sales" title={list.pagination.total ? 'Bu sayfada satış yok' : filter.customer_id || filter.from || filter.to ? 'Bu filtrelerde satış bulunamadı' : 'Henüz satış yok'}
        description="Kaydedilen satışlar burada görüntülenir." /></Card> : <div className="sale-list-surface"><table className="sale-table">
          <caption className="visually-hidden">Satış geçmişi</caption>
          <thead><tr><th scope="col">Tarih</th><th scope="col">Müşteri</th><th scope="col">Toplam</th><th scope="col">Ödenen</th><th scope="col">Kalan</th><th scope="col">Ödeme durumu</th><th scope="col">İşlemi yapan</th></tr></thead>
          <tbody>{list.data.map(sale => <tr key={sale.id}>
            <td><a className="sale-detail-link" href={saleHref(sale.id)} aria-label={`${sale.customer_name} satış detayı`}><time dateTime={sale.created_at}>{saleDate(sale.created_at)}</time></a></td>
            <td data-label="Müşteri"><a className="text-link" href={customerHref(sale.customer_id)}>{sale.customer_name}</a>{sale.status === 'cancelled' && <span> · İptal edildi</span>}</td>
            <td data-label="Toplam"><span className="money">{formatMoney(sale.total_kurus)}</span></td>
            <td data-label="Ödenen"><span className="money">{formatMoney(sale.paid_kurus)}</span></td>
            <td data-label="Kalan"><span className="money">{formatMoney(sale.remaining_kurus)}</span></td>
            <td><PaymentBadge sale={sale} /></td><td data-label="İşlemi yapan">{sale.created_by_username}</td>
          </tr>)}</tbody>
        </table></div>}
      <nav className="sale-pagination" aria-label="Satış sayfaları"><p role="status">{list.pagination.total} satış{list.pagination.totalPages ? ` · Sayfa ${filter.page} / ${list.pagination.totalPages}` : ''}</p>
        <div><Button variant="secondary" disabled={filter.page <= 1} onClick={() => { window.location.hash = saleListHref({ ...filter, page: filter.page - 1 }) }}>Önceki</Button>
          <Button variant="secondary" disabled={filter.page >= list.pagination.totalPages} onClick={() => { window.location.hash = saleListHref({ ...filter, page: filter.page + 1 }) }}>Sonraki</Button></div>
      </nav>
    </>}
  </>
}
