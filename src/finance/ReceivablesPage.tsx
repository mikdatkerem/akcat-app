import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Card, EmptyState, ErrorState, Input, LoadingState, Button } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listReceivables } from '../services/finance'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { saleDate } from '../sales/presentation'
import { customerHref } from '../customers/routing'
import { Pagination } from './Pagination'
import { paymentHref, useFinanceLocation } from './routing'
import './finance.css'

export function ReceivablesPage() {
  const hash = useFinanceLocation()
  const filter = useMemo(() => { const params = new URLSearchParams(hash.split('?')[1]); const page = Number(params.get('page') ?? 1); return {
    q: (params.get('q') ?? '').slice(0, 100), page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1, pageSize: 20,
  } }, [hash])
  return <DebtorList key={hash} filter={filter} />
}
function DebtorList({ filter }: { filter: { q: string; page: number; pageSize: number } }) {
  const [search, setSearch] = useState(filter.q)
  const load = useCallback(() => listReceivables(filter), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  const href = (page: number, q = filter.q) => '#/veresiye?' + new URLSearchParams({ q, page: String(page) })
  function apply(event: FormEvent) { event.preventDefault(); const next = href(1, search.trim()); if (window.location.hash === next) retry(); window.location.hash = next }
  return <>
    <PageHeader title="Veresiye" description="Borcu bulunan müşteriler ve güncel açık satışları." />
    <form className="finance-search" role="search" aria-label="Borçlu müşteri arama" onSubmit={apply}>
      <Input label="Borçlu müşteri adı" type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /><Button type="submit" variant="secondary">Ara</Button>
    </form>
    {!result ? <LoadingState label="Borçlu müşteriler yükleniyor…" /> : result.error ? <ErrorState title="Veresiye listesi yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <Card title="Borçlu müşteriler"><EmptyState icon="credit" title={filter.q ? 'Bu aramada borçlu müşteri bulunamadı' : 'Borçlu müşteri yok'} description="Açık borcu olmayan müşteriler bu listede gösterilmez." /></Card>
        : <div className="finance-table-surface"><table className="finance-table"><caption className="visually-hidden">Borçlu müşteriler</caption>
          <thead><tr><th scope="col">Müşteri</th><th scope="col">Telefon</th><th scope="col">Toplam borç</th><th scope="col">Açık satış</th><th scope="col">Son tahsilat</th><th scope="col">İşlem</th></tr></thead>
          <tbody>{result.data.data.map(customer => <tr key={customer.id}>
            <td><a className="finance-link finance-customer-name" href={customerHref(customer.id)}>{customer.name}</a></td><td data-label="Telefon">{customer.phone || 'Belirtilmedi'}</td>
            <td data-label="Toplam borç"><span className="money">{formatMoney(customer.total_debt_kurus)}</span></td><td data-label="Açık satış">{customer.open_sales_count}</td>
            <td data-label="Son tahsilat">{customer.last_payment_at ? saleDate(customer.last_payment_at) : 'Henüz tahsilat yok'}</td>
            <td><a className="ui-button ui-button--secondary" href={paymentHref(customer.id)}>Tahsilat al</a></td>
          </tr>)}</tbody></table></div>}
      <Pagination page={result.data.pagination} label="Borçlu müşteri sayfaları" onPage={page => { window.location.hash = href(page) }} />
    </>}
  </>
}
