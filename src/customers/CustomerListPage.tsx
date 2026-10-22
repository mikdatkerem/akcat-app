import { useCallback, useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listCustomers, type CustomerFilter } from '../services/customers'
import { customerHref, customerListHref } from './routing'
import { useResource } from '../hooks/useResource'

export function CustomerListPage({ filter }: { filter: CustomerFilter }) {
  const [search, setSearch] = useState(filter.q)
  const [status, setStatus] = useState(filter.status)
  const load = useCallback(() => listCustomers(filter), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  function searchCustomers(event: FormEvent) {
    event.preventDefault()
    window.location.hash = customerListHref(search.trim(), status, 1, filter.pageSize)
    if (search.trim() === filter.q && status === filter.status && filter.page === 1) retry()
  }
  const list = result?.data
  return <>
    <PageHeader title="Müşteriler" description="Müşteri bilgileri ve teslimat notlarını yönetin."
      actions={<a className="ui-button ui-button--primary" href="#/musteriler/yeni">Müşteri ekle</a>} />
    <form className="customer-filters" onSubmit={searchCustomers} role="search" aria-label="Müşteri arama">
      <Input label="İsim veya telefon" name="q" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <Select label="Durum" value={status} onChange={event => setStatus(event.target.value as CustomerFilter['status'])}>
        <option value="all">Tümü</option><option value="active">Aktif</option><option value="inactive">Pasif</option>
      </Select>
      <Button type="submit" variant="secondary">Ara</Button>
    </form>
    {!result ? <LoadingState label="Müşteriler yükleniyor…" /> : result.error ? <ErrorState title="Müşteriler yüklenemedi" description={result.error} onRetry={retry} /> : list && <>
      {list.data.length === 0 ? <Card title="Müşteri listesi"><EmptyState icon="customers" title={filter.q || filter.status !== 'all' ? 'Bu filtrelerde müşteri bulunamadı' : list.pagination.total === 0 ? 'Henüz müşteri yok' : 'Bu sayfada müşteri yok'}
        description={filter.q || filter.status !== 'all' ? 'Aramayı veya durum filtresini değiştirin.' : 'Yeni bir müşteri ekleyerek başlayabilirsiniz.'} /></Card>
        : <div className="customer-list-surface">
          <table className="customer-table"><caption className="visually-hidden">Müşteriler</caption>
            <thead><tr><th scope="col">Müşteri adı</th><th scope="col">Telefon</th><th scope="col">Adres</th><th scope="col">Durum</th><th scope="col"><span className="visually-hidden">İşlem</span></th></tr></thead>
            <tbody>{list.data.map(customer => <tr key={customer.id}>
              <td><a className="customer-name" href={customerHref(customer.id)}>{customer.name}</a></td>
              <td data-label="Telefon">{customer.phone || 'Belirtilmedi'}</td>
              <td className="customer-address" data-label="Adres"><span>{customer.address}</span></td>
              <td><Badge tone={customer.is_active ? 'success' : 'neutral'}>{customer.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
              <td><a className="customer-detail-link" href={customerHref(customer.id)} aria-label={`${customer.name} detaylarını görüntüle`}>Detay</a></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <nav className="customer-pagination" aria-label="Müşteri sayfaları">
        <p role="status">{list.pagination.total} müşteri{list.pagination.totalPages > 0 ? ` · Sayfa ${list.pagination.page} / ${list.pagination.totalPages}` : ''}</p>
        <div>
          <Button variant="secondary" disabled={filter.page <= 1} onClick={() => { window.location.hash = customerListHref(filter.q, filter.status, filter.page - 1, filter.pageSize) }}>Önceki</Button>
          <Button variant="secondary" disabled={filter.page >= list.pagination.totalPages} onClick={() => { window.location.hash = customerListHref(filter.q, filter.status, filter.page + 1, filter.pageSize) }}>Sonraki</Button>
        </div>
      </nav>
    </>}
  </>
}
