import { useCallback, useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, ErrorState, Icon, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getCustomer, listCustomers, type Customer } from '../services/customers'
import { listSales, type SaleFilter } from '../services/sales'
import type { Role } from '../services/auth'
import { formatMoney } from '../utils/format'
import { useResource } from '../hooks/useResource'
import { RecordPicker } from './RecordPicker'
import { PaymentBadge } from './SaleRecord'
import { saleDate } from './presentation'
import { saleHref, saleListHref } from './routing'
import { customerHref } from '../customers/routing'
import { DayNavigator } from '../finance/DayNavigator'
import { useIstanbulToday } from '../finance/useIstanbulToday'
import { dayRangeLabel, validDay } from '../utils/day'
import { FilterPanel } from '../finance/FilterPanel'

const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'all' })
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
export function SaleListPage({ filter, role, onCreate }: { filter: SaleFilter; role: Role; onCreate: (customer?: Customer) => void }) {
  const today = useIstanbulToday()
  const [choosing, setChoosing] = useState(false)
  const loadCustomer = useCallback(() => filter.customer_id ? getCustomer(filter.customer_id) : Promise.resolve(null), [filter.customer_id])
  const { result: selected, retry: retryCustomer } = useResource(filter.customer_id ?? '', loadCustomer)
  const startDate = filter.start_date ?? (filter.from ? day.format(new Date(filter.from)) : '')
  const endDate = filter.end_date ?? (filter.to ? day.format(new Date(Date.parse(filter.to) - 1)) : '')
  const hasRange = !!(startDate || endDate), selectedDay = endDate || startDate || filter.day || today
  const [from, setFrom] = useState(hasRange ? startDate : selectedDay)
  const [to, setTo] = useState(hasRange ? endDate : selectedDay)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(filter.status ?? 'all')
  const load = useCallback(() => listSales(filter), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  function apply(event: FormEvent) {
    event.preventDefault()
    if ([from, to].some(value => value && (!validDay(value) || value > today))) {
      setError('Geçerli bir tarih seçin; bugünden ileri gidilemez.'); return
    }
    if (from && to && from > to) { setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.'); return }
    const next: SaleFilter = { page: 1, pageSize: filter.pageSize, customer_id: filter.customer_id, status }
    if (from !== to) { next.start_date = from || undefined; next.end_date = to || undefined }
    else next.day = from || selectedDay
    setError('')
    const href = saleListHref(next)
    if (window.location.hash === href) retry()
    window.location.hash = href
  }
  const list = result?.data
  return <>
    <PageHeader title="Satışlar" description={role === 'admin' ? 'Şirket satışları ve güncel ödeme durumları.' : 'Tüm çalışanların satışları ve güncel ödeme durumları.'}
      actions={<Button disabled={!!filter.customer_id && !selected?.data} onClick={() => onCreate(selected?.data ?? undefined)}>Yeni satış</Button>} />
    <Card title="Müşteri Seçimi" className="receivable-selection">
      {filter.customer_id && !choosing ? <div className="receivable-selected">
        <div>{!selected ? <LoadingState label="Müşteri yükleniyor…" /> : selected.error ? <ErrorState title="Müşteri bilgileri alınamadı" description={selected.error} onRetry={retryCustomer} /> : selected.data && <><strong>{selected.data.name}</strong><p>{[selected.data.phone, selected.data.address?.slice(0, 140)].filter(Boolean).join(' · ')}</p></>}</div>
        <div className="finance-filter-actions"><Button variant="secondary" onClick={() => setChoosing(true)}>Müşteriyi Değiştir</Button><Button variant="ghost" onClick={() => { window.location.hash = saleListHref({ ...filter, customer_id: undefined, page: 1 }) }}>Seçimi Temizle</Button></div>
      </div> : <><RecordPicker label="Müşteri ara…" searchRequired load={customers} describe={value => [value.phone, value.address?.slice(0, 140)].filter(Boolean).join(' · ')} onSelect={customer => { setChoosing(false); window.location.hash = saleListHref({ ...filter, customer_id: customer.id, page: 1 }) }} />
        {choosing && <Button variant="ghost" onClick={() => setChoosing(false)}>Vazgeç</Button>}</>}
    </Card>
    <DayNavigator maxDay={today} day={selectedDay} dateInput={false} periodLabel={dayRangeLabel(startDate, endDate)} onChange={day => { window.location.hash = saleListHref({ ...filter, day, from: undefined, to: undefined, start_date: undefined, end_date: undefined, page: 1 }) }} />
    <FilterPanel active={!!(hasRange || selectedDay !== today || (filter.status && filter.status !== 'all'))}>
    <section className="sale-history-filters" aria-label="Satış filtreleri">
      <form className="finance-filters finance-amount-filters" onSubmit={apply}>
        <Input label="Başlangıç tarihi" type="date" min="1900-01-01" max={today} value={from} onChange={event => setFrom(event.target.value)} />
        <Input label="Bitiş tarihi" type="date" min="1900-01-01" max={today} value={to} onChange={event => setTo(event.target.value)} />
        <Select label="Satış durumu" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Tümü</option><option value="completed">Tamamlanan</option><option value="cancelled">İptal edilen</option></Select>
        <div className="finance-filter-actions"><Button type="submit" variant="secondary">Filtrele</Button>
        <Button variant="ghost" onClick={() => { setFrom(today); setTo(today); setStatus('all'); setError(''); const href = saleListHref({ customer_id: filter.customer_id, page: 1, pageSize: filter.pageSize, day: today }); if (window.location.hash === href) retry(); window.location.hash = href }}>Temizle</Button></div>
      </form>
      {error && <p className="sale-validation" role="alert">{error}</p>}
    </section>
    </FilterPanel>
    {!result ? <LoadingState label="Satışlar yükleniyor…" /> : result.error ? <ErrorState title="Satışlar yüklenemedi" description={result.error} onRetry={retry} /> : list && <>
      {list.data.length === 0 ? <Card title="Satış geçmişi"><EmptyState icon="sales" title={list.pagination.total ? 'Bu sayfada satış yok' : 'Seçili tarihlerde satış bulunamadı'}
        description="Kaydedilen satışlar burada görüntülenir." /></Card> : <div className="operation-table-scroll" role="region" aria-label="Satışlar tablosu" tabIndex={0}><table className="operation-table operation-table--sales">
          <caption className="visually-hidden">Satış geçmişi</caption>
          <thead><tr><th scope="col">Tarih / Saat</th><th scope="col">Müşteri</th><th scope="col">Toplam</th><th scope="col">Ödenen</th><th scope="col">Kalan</th><th scope="col">Ödeme durumu</th><th scope="col">İşlemi yapan</th><th scope="col"><span className="visually-hidden">Detay</span></th></tr></thead>
          <tbody>{list.data.map(sale => <tr key={sale.id}>
            <td><time dateTime={sale.created_at}>{saleDate(sale.created_at)}</time></td>
            <td data-label="Müşteri"><div className="sale-customer-cell">{sale.customer_id ? <a className="text-link" href={customerHref(sale.customer_id!)}>{sale.customer_name}</a> : <strong>{sale.customer_name}</strong>}{sale.voucher_operation !== 'none' && <span className="sale-kind-label">{sale.voucher_operation === 'purchase' ? 'Fiş Satışı' : 'Fişle Teslimat'} · {sale.voucher_quantity} adet</span>}{sale.sale_type === 'walk_in' && <span className="sale-kind-label">Hızlı Satış</span>}</div>{sale.status === 'cancelled' && <span> · İptal edildi</span>}</td>
            <td data-label="Toplam"><span className="money">{formatMoney(sale.total_kurus)}</span></td>
            <td data-label="Ödenen"><span className="money">{formatMoney(sale.paid_kurus)}</span></td>
            <td data-label="Kalan"><span className="money">{formatMoney(sale.remaining_kurus)}</span></td>
            <td><PaymentBadge sale={sale} /></td><td data-label="İşlemi yapan">{sale.created_by_username}</td>
            <td className="sale-action-cell"><a className="sale-detail-link" href={saleHref(sale.id)} aria-label={`${sale.customer_name} satış detayı`} title="Satış detayını görüntüle"><Icon name="info" /></a></td>
          </tr>)}</tbody>
        </table></div>}
      {list.pagination.totalPages > 1 && <nav className="sale-pagination" aria-label="Satış sayfaları"><p role="status">{list.pagination.total} satış{list.pagination.totalPages ? ` · Sayfa ${filter.page} / ${list.pagination.totalPages}` : ''}</p>
        <div><Button variant="secondary" disabled={filter.page <= 1} onClick={() => { window.location.hash = saleListHref({ ...filter, page: filter.page - 1 }) }}>Önceki</Button>
          <Button variant="secondary" disabled={filter.page >= list.pagination.totalPages} onClick={() => { window.location.hash = saleListHref({ ...filter, page: filter.page + 1 }) }}>Sonraki</Button></div>
      </nav>}
    </>}
  </>
}
