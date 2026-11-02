import { adjustmentLabels } from '../services/adjustments'
import { useCallback, useState, type FormEvent } from 'react'
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { listPayments, type PaymentFilter, type Payment } from '../services/finance'
import type { PaymentMethod } from '../services/sales'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { methodLabels, saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { customerHref } from '../customers/routing'
import { Pagination } from './Pagination'
import { correctionHref } from '../services/corrections'
import { AmountRangeFields } from './AmountRangeFields'
import { parseAmountRange } from '../utils/amountRange'
import { FilterPanel } from './FilterPanel'
import { DayNavigator } from './DayNavigator'
import { dayRangeLabel, validDay } from '../utils/day'
import { useIstanbulToday } from './useIstanbulToday'

function PaymentActions({ payment }: { payment: Payment }) {
  return <div className="finance-history-actions">
    {payment.sale_id && <a className="finance-link" href={saleHref(payment.sale_id)}>Satış detayı</a>}
    {payment.is_valid && <a className="finance-link" href={correctionHref('payment', payment.id)}>Düzeltme talebi</a>}
    {!payment.is_valid && <span>{payment.adjustment_kind ? adjustmentLabels[payment.adjustment_kind] : 'Ters kayıtla kapatılmış'}</span>}
  </div>
}
export function PaymentHistory({ customerId, revision = 0 }: { customerId?: string; revision?: number }) {
  const today = useIstanbulToday()
  const [day, setDay] = useState<string | null>(null), [page, setPage] = useState(1), [method, setMethod] = useState<PaymentMethod | ''>('')
  const [startInput, setFrom] = useState<string | null>(null), [endInput, setTo] = useState<string | null>(null), [error, setError] = useState('')
  const [search, setSearch] = useState(''), [minimum, setMinimum] = useState(''), [maximum, setMaximum] = useState('')
  const [filters, setFilters] = useState<Pick<PaymentFilter, 'start_date' | 'end_date' | 'q' | 'min_amount_kurus' | 'max_amount_kurus'>>({})
  const selectedDay = !day || day > today ? today : day
  const from = startInput ?? selectedDay, to = endInput ?? selectedDay
  const applied = { ...filters, start_date: filters.start_date && filters.start_date > today ? today : filters.start_date, end_date: filters.end_date && filters.end_date > today ? today : filters.end_date }
  const load = useCallback(() => listPayments({ page, pageSize: 20, grouped: true, customer_id: customerId, method: method || undefined,
    day: applied.start_date || applied.end_date ? undefined : selectedDay, ...filters, start_date: applied.start_date, end_date: applied.end_date }), [page, customerId, method, selectedDay, filters, applied.start_date, applied.end_date])
  const { result, retry } = useResource(`${customerId}:${page}:${method}:${selectedDay}:${JSON.stringify(applied)}:${revision}`, load)
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      if ([from,to].some(d => d && (!validDay(d) || d > today))) throw new Error('Geçerli bir tarih seçin; bugünden ileri gidilemez.')
      if (from && to && from > to) throw new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.')
      const range = parseAmountRange(minimum, maximum)
      setDay(to || from || selectedDay)
      setFilters({ q: search.trim(), min_amount_kurus: range.min, max_amount_kurus: range.max,
        start_date: from !== to ? from || undefined : undefined,
        end_date: from !== to ? to || undefined : undefined })
      setPage(1); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Filtreleri kontrol edin.') }
  }
  function clear() { setSearch(''); setMinimum(''); setMaximum(''); setDay(null); setFrom(null); setTo(null); setMethod(''); setFilters({}); setError(''); setPage(1) }
  return <section aria-label="Tahsilat geçmişi">
    <DayNavigator day={applied.end_date || applied.start_date || selectedDay} maxDay={today} dateInput={false} periodLabel={dayRangeLabel(applied.start_date, applied.end_date)} onChange={value => { setDay(value); setPage(1); setFrom(value); setTo(value); setError(''); setFilters(v => ({ ...v, start_date: undefined, end_date: undefined })) }} />
    <FilterPanel active={!!(selectedDay !== today || method || filters.q || filters.start_date || filters.end_date || filters.min_amount_kurus !== undefined || filters.max_amount_kurus !== undefined)}>
      <form className="finance-filters finance-amount-filters" onSubmit={apply} role="search" aria-label="Tahsilat filtreleri">
        <Input label="Başlangıç tarihi" type="date" min="1900-01-01" max={today} value={from} onChange={e => setFrom(e.target.value)} />
        <Input label="Bitiş tarihi" type="date" min="1900-01-01" max={today} value={to} onChange={e => setTo(e.target.value)} />
        <Select label="Ödeme yöntemi" value={method} onChange={e => { setMethod(e.target.value as PaymentMethod | ''); setPage(1) }}><option value="">Tümü</option><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option></Select>
        {!customerId && <Input label="Müşteri adı" type="search" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} />}
        <AmountRangeFields minimum={minimum} maximum={maximum} onMinimum={setMinimum} onMaximum={setMaximum} />
        <div className="finance-filter-actions"><Button type="submit" variant="secondary">Filtrele</Button><Button variant="ghost" onClick={clear}>Temizle</Button></div>
        <p className="finance-filter-hint">Tutar filtresi toplu tahsilatın toplamına uygulanır.</p>
      </form>
    </FilterPanel>
    {customerId && <a className="finance-link" href="#/tahsilatlar">Tüm müşteriler</a>}
    {error && <p role="alert" className="finance-validation">{error}</p>}
    {!result ? <LoadingState label="Tahsilatlar yükleniyor…" /> : result.error ? <ErrorState title="Tahsilatlar yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Seçili tarihlerde tahsilat bulunamadı" description="Başka bir gün seçebilir veya filtreleri değiştirebilirsiniz." />
        : <div className="operation-table-scroll" role="region" aria-label="Tahsilatlar tablosu" tabIndex={0}><table className="operation-table"><caption className="visually-hidden">Tahsilat defteri</caption>
          <thead><tr><th scope="col">Tarih / Saat</th><th scope="col">Müşteri</th><th scope="col" className="money">Tahsilat tutarı</th><th scope="col">Yöntem</th><th scope="col">İşlemi yapan</th><th scope="col">Tür / İşlem</th></tr></thead>
          <tbody>{result.data.data.map(payment => <tr key={payment.id}>
            <td><time dateTime={payment.created_at}>{saleDate(payment.created_at)}</time></td>
            <td>{payment.customer_id ? <a className="finance-link" href={customerHref(payment.customer_id)}>{payment.customer_name}</a> : payment.customer_name}</td>
            <td className="money">{formatMoney(payment.amount_kurus)}{payment.collection_id && payment.valid_amount_kurus !== payment.amount_kurus && <small className="operation-reference">Geçerli: {formatMoney(payment.valid_amount_kurus ?? 0)}</small>}</td>
            <td>{methodLabels[payment.method]}</td><td>{payment.created_by_username}</td>
            <td>{payment.collection_id ? <details><summary>Toplu tahsilat · {payment.allocations?.length} satış</summary>
              <small className="operation-reference">Tahsilat no: {payment.id}</small>
              <ul className="operation-allocations">{payment.allocations?.map(allocation => <li key={allocation.id}><small className="operation-reference">Satış no: {allocation.sale_id}</small><span className="money">{formatMoney(allocation.amount_kurus)}</span><PaymentActions payment={allocation} /></li>)}</ul>
            </details> : <><Badge tone={payment.is_valid ? 'success' : 'neutral'}>{payment.adjustment_kind ? adjustmentLabels[payment.adjustment_kind] : payment.reversal_of_payment_id ? 'Ters kayıt' : payment.is_initial ? 'İlk ödeme' : 'Tahsilat'}</Badge><PaymentActions payment={payment} /></>}</td>
          </tr>)}</tbody></table></div>}
      {result.data.pagination.totalPages > 1 && <Pagination page={result.data.pagination} label="Tahsilat sayfaları" onPage={setPage} />}
    </>}
  </section>
}
