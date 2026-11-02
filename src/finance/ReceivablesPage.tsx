import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Card, EmptyState, ErrorState, Input, LoadingState, Button, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { dailyMovements, type LedgerFilter } from '../services/finance'
import { listCustomers } from '../services/customers'
import { RecordPicker } from '../sales/RecordPicker'
import { useResource } from '../hooks/useResource'
import { parseAmountRange, readKurusBound } from '../utils/amountRange'
import { priceInputFromKurus } from '../utils/format'
import { AmountRangeFields } from './AmountRangeFields'
import { FilterPanel } from './FilterPanel'
import { Pagination } from './Pagination'
import { useFinanceLocation } from './routing'
import { ReceivableAccount } from './ReceivableAccount'
import { useIstanbulToday } from './useIstanbulToday'
import { DayNavigator } from './DayNavigator'
import { todayIstanbul, validDay } from '../utils/day'
import { MovementTable } from './MovementTable'
import './finance.css'
const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'all' })
const displayDate = (day: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(day + 'T12:00:00Z'))
export function ReceivablesPage() {
  const hash = useFinanceLocation(), today = useIstanbulToday()
  const route = useMemo(() => {
    const params = new URLSearchParams(hash.split('?')[1])
    const requested = params.get('day') || today
    return { customer: params.get('customer_id') || '', day: requested > today && validDay(requested) ? today : requested, params }
  }, [hash, today])
  if (!validDay(route.day) || (route.customer && !/^[a-f0-9-]{36}$/i.test(route.customer))) return <ErrorState title="Geçersiz filtre" description="Müşteri ve tarih seçimini kontrol edin." />
  return <ReceivableView key={hash + today} today={today} {...route} />
}
function ReceivableView({ customer, day, params, today }: { customer: string; day: string; params: URLSearchParams; today: string }) {
  const [choosing, setChoosing] = useState(false)
  const requestedStart = params.get('start_date') || '', requestedEnd = params.get('end_date') || ''
  const startDate = validDay(requestedStart) && requestedStart > today ? today : requestedStart
  const endDate = validDay(requestedEnd) && requestedEnd > today ? today : requestedEnd
  const hasRange = !!(startDate || endDate)
  const [from, setFrom] = useState(hasRange ? startDate : day), [to, setTo] = useState(hasRange ? endDate : day)
  const type = (params.get('type') === 'payment' ? 'all' : params.get('type') || 'all') as LedgerFilter['type']
  const [q, setQ] = useState(params.get('q') || ''), [error, setError] = useState('')
  const rawMin = params.get('min_debt_kurus'), rawMax = params.get('max_debt_kurus')
  let minAmount: number | undefined, maxAmount: number | undefined
  try { minAmount = readKurusBound(params.get('min_amount_kurus')); maxAmount = readKurusBound(params.get('max_amount_kurus')) } catch { /* Report invalid bounds below. */ }
  const [amountMinimum, setAmountMinimum] = useState(minAmount === undefined ? '' : priceInputFromKurus(minAmount)), [amountMaximum, setAmountMaximum] = useState(maxAmount === undefined ? '' : priceInputFromKurus(maxAmount))
  let min: number | undefined, max: number | undefined, badFilter = ''
  const badDate = [startDate, endDate].some(value => value && !validDay(value)) || (startDate && endDate && startDate > endDate)
  try { minAmount = readKurusBound(params.get('min_amount_kurus')); maxAmount = readKurusBound(params.get('max_amount_kurus')); if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) throw new Error('Hareket tutarı aralığı geçerli değil.'); min = readKurusBound(rawMin); max = readKurusBound(rawMax); if (min !== undefined && max !== undefined && min > max) throw new Error('Tutar aralığı geçerli değil.') }
  catch (cause) { badFilter = cause instanceof Error ? cause.message : 'Filtre geçerli değil.' }
  if (badDate) badFilter = 'Geçerli bir tarih aralığı seçin; başlangıç bitişten sonra olamaz.'
  const periodLabel = hasRange && !badDate ? startDate && endDate ? `${displayDate(startDate)} – ${displayDate(endDate)}` : startDate ? `${displayDate(startDate)} tarihinden itibaren` : `${displayDate(endDate)} tarihine kadar` : undefined
  const [minimum, setMinimum] = useState(min === undefined ? '' : priceInputFromKurus(min)), [maximum, setMaximum] = useState(max === undefined ? '' : priceInputFromKurus(max))
  const rawPage = Number(params.get('page') || 1), page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1
  const load = useCallback(() => customer || badFilter ? Promise.resolve(null) : dailyMovements({ exclude_payments: true, day: hasRange ? undefined : day, start_date: startDate || undefined, end_date: endDate || undefined, type, page, pageSize: 20, q: params.get('q') || '', min_debt_kurus: min, max_debt_kurus: max, min_amount_kurus: minAmount, max_amount_kurus: maxAmount }), [customer, badFilter, day, hasRange, startDate, endDate, type, page, params, min, max, minAmount, maxAmount])
  const { result, retry } = useResource(`${customer}:${day}:${params}`, load)
  function navigate(values: Record<string, string>) { const next = new URLSearchParams(params); for (const [k,v] of Object.entries(values)) { if (v) next.set(k,v); else next.delete(k) }; window.location.hash = '#/veresiye?' + next }
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      if ([from, to].some(value => value && (!validDay(value) || value > today))) throw new Error('Geçerli bir tarih seçin; bugünden ileri gidilemez.')
      if (from && to && from > to) throw new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.')
      const range = parseAmountRange(minimum, maximum), amounts = parseAmountRange(amountMinimum, amountMaximum)
      setError(''); navigate({ day: to || from || day, start_date: from === to ? '' : from, end_date: from === to ? '' : to, min_amount_kurus: amounts.min === undefined ? '' : String(amounts.min), max_amount_kurus: amounts.max === undefined ? '' : String(amounts.max), q: q.trim(), type: type || 'all', min_debt_kurus: range.min === undefined ? '' : String(range.min), max_debt_kurus: range.max === undefined ? '' : String(range.max), page: '1' })
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Tutarı kontrol edin.') }
  }
  return <>
    <PageHeader title="Veresiye" description={customer ? 'Müşterinin tüm hareketleri ve güncel toplam borcu.' : 'Müşteri satışları ve finansal düzeltmeler.'} />
    {(!customer || choosing) && <Card title="Müşteri Seçimi" className="receivable-selection"><RecordPicker label="Müşteri ara…" searchRequired load={customers} describe={c => [c.phone, c.address?.slice(0, 140)].filter(Boolean).join(' · ')} onSelect={c => { setChoosing(false); navigate({ customer_id: c.id, page: '1' }) }} />
      {choosing && <Button variant="ghost" onClick={() => setChoosing(false)}>Vazgeç</Button>}
    </Card>}
    {customer ? <ReceivableAccount id={customer} change={() => setChoosing(true)} clear={() => { window.location.hash = '#/veresiye?day=' + todayIstanbul() }} /> : <>
      <DayNavigator day={!badDate && (endDate || startDate) || day} maxDay={today} dateInput={false} periodLabel={periodLabel} onChange={d => navigate({ day: d, start_date: '', end_date: '', page: '1' })} />
      <FilterPanel active={!!(hasRange || day !== today || type !== 'all' || params.get('q') || minAmount !== undefined || maxAmount !== undefined || min !== undefined || max !== undefined)}><form className="finance-filters finance-amount-filters" onSubmit={apply}>
        <Input label="Başlangıç tarihi" type="date" min="1900-01-01" max={today} value={from} onChange={e => setFrom(e.target.value)} />
        <Input label="Bitiş tarihi" type="date" min="1900-01-01" max={today} value={to} onChange={e => setTo(e.target.value)} />
        <Select label="İşlem türü" value={type} onChange={e => navigate({ type: e.target.value, page: '1' })}><option value="all">Tümü</option><option value="sale">Satış</option><option value="cancellation">İptal</option><option value="record_reversal">Hatalı kayıt tersi</option><option value="external_refund">Harici iade</option><option value="reversal">Geçmiş ters kayıt</option></Select>
        <Input label="Müşteri adı" type="search" value={q} maxLength={100} onChange={e => setQ(e.target.value)} />
        <AmountRangeFields minimum={amountMinimum} maximum={amountMaximum} onMinimum={setAmountMinimum} onMaximum={setAmountMaximum} />
        <AmountRangeFields debt minimum={minimum} maximum={maximum} onMinimum={setMinimum} onMaximum={setMaximum} />
        <div className="finance-filter-actions"><Button type="submit" variant="secondary">Filtrele</Button><Button variant="ghost" onClick={() => navigate({ day: today, start_date: '', end_date: '', min_amount_kurus: '', max_amount_kurus: '', type: 'all', q: '', min_debt_kurus: '', max_debt_kurus: '', page: '1' })}>Temizle</Button></div>
        <p className="finance-filter-hint">Tutar sınırları hareket tutarını, borç sınırları müşterinin güncel toplam borcunu filtreler.</p>
      </form></FilterPanel>
      {(badFilter || error) && <p className="finance-validation" role="alert">{badFilter || error}</p>}
      {!badFilter && (!result ? <LoadingState label="Hareketler yükleniyor…" /> : result.error ? <ErrorState title="Hareketler alınamadı" description={result.error} onRetry={retry} /> : result.data && <>
        {!result.data.data.length ? <Card title="Hareketler"><EmptyState title="Seçili tarihlerde hareket yok" description="Başka bir tarih veya müşteri seçebilirsiniz." /></Card> : <MovementTable separateAmounts actorColumn data={result.data.data} customers daily showDate={hasRange} />}
        {result.data.pagination.totalPages > 1 && <Pagination page={result.data.pagination} label="Hareket sayfaları" onPage={value => navigate({ page: String(value) })} />}
      </>)}
    </>}
  </>
}
