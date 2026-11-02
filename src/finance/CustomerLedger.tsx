import { useCallback, useState, type FormEvent } from 'react'
import { Card, EmptyState, ErrorState, LoadingState, Select, Input, Button } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { customerLedger, type LedgerFilter } from '../services/finance'
import { formatMoney } from '../utils/format'
import { Pagination } from './Pagination'
import { MovementTable } from './MovementTable'

export function CustomerLedger({ id }: { id: string }) {
  const [page, setPage] = useState(1), [type, setType] = useState<LedgerFilter['type']>('all')
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [error, setError] = useState('')
  const [range, setRange] = useState<{ start_date?: string; end_date?: string }>({})
  const load = useCallback(() => customerLedger(id, { page, pageSize: 20, type, ...range }), [id, page, type, range])
  const { result, retry } = useResource(`${id}:${page}:${type}:${JSON.stringify(range)}`, load)
  function apply(event: FormEvent) {
    event.preventDefault()
    if (from && to && from > to) { setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.'); return }
    setRange({ start_date: from || undefined, end_date: to || undefined }); setPage(1); setError('')
  }
  return <Card title={result?.data ? `${result.data.customer.name} — Borç Geçmişi` : 'Borç Geçmişi'}>
    {result?.data && <p className="money--prominent">Güncel Kalan Bakiye: {formatMoney(result.data.summary.total_debt_kurus)}</p>}
    <form className="finance-filters" onSubmit={apply}>
      <Select label="Hareket türü" value={type} onChange={e => { setType(e.target.value as LedgerFilter['type']); setPage(1) }}>
        <option value="all">Tümü</option><option value="sale">Satışlar</option><option value="payment">Ödemeler</option><option value="reversal">Geçmiş ters kayıtlar</option><option value="record_reversal">Hatalı kayıt tersleri</option><option value="external_refund">Harici iadeler</option><option value="cancellation">Satış iptalleri</option>
      </Select>
      <Input label="Başlangıç tarihi" type="date" min="1900-01-01" max="9998-12-30" value={from} onChange={e => setFrom(e.target.value)} />
      <Input label="Bitiş tarihi" type="date" min="1900-01-01" max="9998-12-30" value={to} onChange={e => setTo(e.target.value)} />
      <div className="finance-filter-actions"><Button type="submit" variant="secondary">Filtrele</Button><Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setRange({}); setType('all'); setPage(1); setError('') }}>Tüm geçmiş</Button></div>
    </form>
    {error && <p role="alert">{error}</p>}
    {!result ? <LoadingState label="Hareketler yükleniyor…" /> : result.error ? <ErrorState title="Finansal hareketler yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Finansal hareket bulunamadı" description="Seçili filtrelerde kayıt yok." /> : <MovementTable data={result.data.data} />}
      <Pagination page={result.data.pagination} label="Finansal hareket sayfaları" onPage={setPage} />
    </>}
  </Card>
}
