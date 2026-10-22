import { useState, type FormEvent } from 'react'
import { Button, Input, Select } from '../components/ui'
import type { ReportFilter } from '../services/reports'
import { reportsHref, type ReportMode } from './routing'

export function ReportFilters({ mode, filter, retry }: { mode: ReportMode; filter: ReportFilter; retry: () => void }) {
  const [period, setPeriod] = useState(filter.period), [from, setFrom] = useState(filter.from ?? ''), [to, setTo] = useState(filter.to ?? '')
  const [search, setSearch] = useState(filter.q ?? ''), [view, setView] = useState(filter.view ?? 'sales'), [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (mode !== 'receivables' && period === 'custom' && (!from || !to || from > to)) { setError('Geçerli bir başlangıç ve bitiş tarihi girin.'); return }
    const next: ReportFilter = { ...filter, period, page: 1, q: search.trim(), view: mode === 'sales' ? view : 'sales',
      from: period === 'custom' ? from : undefined, to: period === 'custom' ? to : undefined }
    const href = reportsHref(mode, next); setError(''); if (window.location.hash === href) retry(); window.location.hash = href
  }
  return <>
    <form className="report-filters" onSubmit={submit}>
      {mode !== 'receivables' && <Select label="Rapor dönemi" value={period} onChange={event => setPeriod(event.target.value as ReportFilter['period'])}>
        <option value="today">Bugün</option><option value="yesterday">Dün</option><option value="last7">Son 7 gün</option><option value="month">Bu ay</option><option value="custom">Özel tarih aralığı</option>
      </Select>}
      {mode !== 'receivables' && period === 'custom' && <>
        <Input label="Başlangıç tarihi" type="date" required min="1900-01-01" max="9998-12-31" value={from} onChange={event => setFrom(event.target.value)} />
        <Input label="Bitiş tarihi" hint="Seçilen gün dahildir." type="date" required min="1900-01-01" max="9998-12-31" value={to} onChange={event => setTo(event.target.value)} />
      </>}
      {mode === 'sales' && <Select label="Satış raporu görünümü" value={view} onChange={event => setView(event.target.value as NonNullable<ReportFilter['view']>)}>
        <option value="sales">Geçerli satışlar</option><option value="cancelled">İptal edilen satışlar</option><option value="items">Satış kalemleri</option><option value="products">Ürün bazında</option>
      </Select>}
      <Input label={mode === 'employees' ? 'Çalışan ara' : mode === 'sales' && view === 'products' ? 'Ürün adı ara' : 'Müşteri adı ara'} type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <Button type="submit" variant="secondary">Raporu Getir</Button>
    </form>
    {error && <p className="report-error" role="alert">{error}</p>}
    {filter.created_by && <p className="report-actor">Seçili çalışan: <span>{filter.created_by}</span> · <a className="text-link" href={reportsHref(mode, { ...filter, created_by: undefined, page: 1 })}>Çalışan filtresini kaldır</a></p>}
  </>
}
