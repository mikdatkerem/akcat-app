import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { getCustomer } from '../services/customers'
import { customerLedger, customerReceivables, type LedgerFilter, type DebtSummary } from '../services/finance'
import { formatMoney } from '../utils/format'
import { validDay } from '../utils/day'
import { saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { paymentHref } from './routing'
import { MovementTable } from './MovementTable'
import { Pagination } from './Pagination'
import { FilterPanel } from './FilterPanel'
import { useIstanbulToday } from './useIstanbulToday'

type HistoryState = { page: number; type: LedgerFilter['type']; from: string; to: string; range: { start_date?: string; end_date?: string } }
export function ReceivableAccount({ id, change, clear }: { id: string; change: () => void; clear: () => void }) {
  const [currentSummary, setCurrentSummary] = useState<DebtSummary | null>(null)
  const receiveSummary = useCallback((summary: DebtSummary) => setCurrentSummary(summary), [])
  const [tab, setTab] = useState<'history' | 'open'>('history'), [openPage, setOpenPage] = useState(1)
  const [history, setHistory] = useState<HistoryState>({ page: 1, type: 'all', from: '', to: '', range: {} })
  const load = useCallback(async () => ({ customer: await getCustomer(id), account: await customerReceivables(id, { page: 1, pageSize: 1 }) }), [id])
  const { result, retry } = useResource(id, load)
  if (!result) return <LoadingState label="Müşteri hesabı yükleniyor…" />
  if (result.error || !result.data) return <ErrorState title="Müşteri hesabı alınamadı" description={result.error ?? 'Tekrar deneyin.'} onRetry={retry} />
  const { customer, account } = result.data, debt = (currentSummary ?? account.summary).total_debt_kurus
  return <>
    <Card title="Seçili Müşteri" className="receivable-selection"><div className="receivable-selected">
      <div><strong>{customer.name}</strong>{(customer.phone || customer.address) && <p>{[customer.phone, customer.address?.slice(0, 140)].filter(Boolean).join(' · ')}</p>}</div>
      <div className="finance-filter-actions"><Button variant="secondary" onClick={change}>Müşteriyi Değiştir</Button><Button variant="ghost" onClick={clear}>Seçimi Temizle</Button></div>
    </div></Card>
    <section className="receivable-balance" aria-label="Müşteri hesap özeti">
      <div><h2>Müşteri Hesap Dökümü</h2><span>Güncel Kalan Bakiye</span><strong className="money">{formatMoney(debt)}</strong>{debt === 0 && <p>Borç bulunmuyor</p>}</div>
      {debt > 0 && customer.is_active && <a className="ui-button ui-button--primary" href={paymentHref(id)}>+ Tahsilat Al</a>}
      {debt > 0 && !customer.is_active && <p>Toplu tahsilat için müşteri hesabı aktif olmalıdır.</p>}
    </section>
    <div role="tablist" aria-label="Müşteri hesap görünümü" className="receivable-tabs">
      {(['history', 'open'] as const).map((key, index) => <button key={key} id={'receivable-tab-' + key} type="button" role="tab" aria-selected={tab === key} aria-controls={'receivable-panel-' + key} tabIndex={tab === key ? 0 : -1}
        onClick={() => setTab(key)} onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'history' : e.key === 'End' ? 'open' : index === 0 ? 'open' : 'history'; setTab(next); document.getElementById('receivable-tab-' + next)?.focus() } }}>
        {key === 'history' ? 'Hesap Hareketleri' : 'Açık Borçlar'}</button>)}
    </div>
    <section role="tabpanel" id={'receivable-panel-' + tab} aria-labelledby={'receivable-tab-' + tab} tabIndex={0}>
      {tab === 'history' ? <AccountHistory id={id} value={history} update={setHistory} onSummary={receiveSummary} /> : <OpenDebts id={id} page={openPage} setPage={setOpenPage} onSummary={receiveSummary} />}
    </section>
  </>
}
function AccountHistory({ id, value, update, onSummary }: { id: string; value: HistoryState; update: (v: HistoryState) => void; onSummary: (summary: DebtSummary) => void }) {
  const today = useIstanbulToday(), [error, setError] = useState('')
  // A clock/date change must never issue a future-range request.
  const range = { start_date: value.range.start_date && value.range.start_date > today ? today : value.range.start_date,
    end_date: value.range.end_date && value.range.end_date > today ? today : value.range.end_date }
  const load = useCallback(() => customerLedger(id, { exclude_payments: true, page: value.page, pageSize: 20, type: value.type, start_date: range.start_date, end_date: range.end_date }), [id, value.page, value.type, range.start_date, range.end_date])
  const { result, retry } = useResource(`${id}:${value.page}:${value.type}:${range.start_date}:${range.end_date}`, load)
  useEffect(() => { if (result?.data) onSummary(result.data.summary) }, [result, onSummary])
  function apply(e: FormEvent) {
    e.preventDefault()
    if ([value.from,value.to].some(d => d && (!validDay(d) || d > today)) || (value.from && value.to && value.from > value.to)) { setError('Geçerli bir tarih aralığı seçin; gelecek tarih kullanılamaz.'); return }
    setError(''); update({ ...value, page: 1, range: { start_date: value.from || undefined, end_date: value.to || undefined } })
  }
  return <>
    <FilterPanel active={!!(value.type !== 'all' || range.start_date || range.end_date)}><form className="finance-filters" onSubmit={apply}>
      <Select label="İşlem türü" value={value.type} onChange={e => update({ ...value, type: e.target.value as LedgerFilter['type'], page: 1 })}>
        <option value="all">Tümü</option><option value="sale">Satış</option><option value="cancellation">İptal</option><option value="record_reversal">Hatalı kayıt tersi</option><option value="external_refund">Harici iade</option><option value="reversal">Geçmiş ters kayıt</option>
      </Select>
      <Input label="Başlangıç tarihi" type="date" min="1900-01-01" max={today} value={value.from} onChange={e => update({ ...value, from: e.target.value })} />
      <Input label="Bitiş tarihi" type="date" min="1900-01-01" max={today} value={value.to} onChange={e => update({ ...value, to: e.target.value })} />
      <div className="finance-filter-actions"><Button type="submit" variant="secondary">Filtrele</Button><Button variant="ghost" onClick={() => { setError(''); update({ page: 1, type: 'all', from: '', to: '', range: {} }) }}>Tüm Geçmiş</Button></div>
    </form></FilterPanel>
    <p className="finance-filter-hint">{range.start_date || range.end_date ? 'Bu tarih aralığında gerçekleşen hareketler gösteriliyor. Güncel bakiye bütün geçmişi kapsar.' : 'Tüm geçmiş gösteriliyor. İşlem sonrası bakiyeler önceki hareketleri de kapsar.'}</p>
    {error && <p role="alert">{error}</p>}
    {!result ? <LoadingState label="Hesap hareketleri yükleniyor…" /> : result.error ? <ErrorState title="Hareketler alınamadı" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length ? <MovementTable separateAmounts actorColumn data={result.data.data} /> : <EmptyState title="Hesap hareketi bulunamadı" description="Bu filtrelerde kayıt yok." />}
      {result.data.pagination.totalPages > 1 && <Pagination page={result.data.pagination} label="Hesap hareketi sayfaları" onPage={page => update({ ...value, page })} />}
    </>}
  </>
}
function OpenDebts({ id, page, setPage, onSummary }: { id: string; page: number; setPage: (page: number) => void; onSummary: (summary: DebtSummary) => void }) {
  const load = useCallback(() => customerReceivables(id, { page, pageSize: 20 }), [id, page])
  const { result, retry } = useResource(`${id}:${page}`, load)
  useEffect(() => { if (result?.data) onSummary(result.data.summary) }, [result, onSummary])
  if (!result) return <LoadingState label="Açık borçlar yükleniyor…" />
  if (result.error || !result.data) return <ErrorState title="Açık borçlar alınamadı" description={result.error ?? 'Tekrar deneyin.'} onRetry={retry} />
  const account = result.data
  return <>
    {!account.data.length ? <EmptyState title="Bu sayfada açık borç yok" description="Tam ödenmiş ve iptal edilmiş satışlar burada gösterilmez." /> : <div className="operation-table-scroll" role="region" aria-label="Açık borçlar tablosu" tabIndex={0}>
      <table className="operation-table"><thead><tr><th scope="col">Satış Tarihi</th><th scope="col">Ürün / Açıklama</th><th scope="col" className="money">Satış Tutarı</th><th scope="col" className="money">Tahsil Edilen</th><th scope="col" className="money">Kalan</th></tr></thead>
        <tbody>{account.data.map(sale => <tr key={sale.id}><td><a className="finance-link" href={saleHref(sale.id)}>{saleDate(sale.created_at)}</a></td><td>{sale.description}</td><td className="money">{formatMoney(sale.total_kurus)}</td><td className="money">{formatMoney(sale.paid_kurus)}</td><td className="money">{formatMoney(sale.remaining_kurus)}</td></tr>)}</tbody>
      </table></div>}
    <p className="receivable-open-total">Toplam Açık Borç: <strong className="money">{formatMoney(account.summary.total_debt_kurus)}</strong></p>
    {account.pagination.totalPages > 1 && <Pagination page={account.pagination} label="Açık borç sayfaları" onPage={setPage} />}
  </>
}
