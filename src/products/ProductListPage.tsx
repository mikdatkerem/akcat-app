import { useCallback, useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listProducts, type ProductFilter } from '../services/products'
import type { Role } from '../services/auth'
import { formatMoney } from '../utils/format'
import { useResource } from '../hooks/useResource'
import { productHref, productListHref } from './routing'
import { ProductActions } from './ProductActions'

export function ProductListPage({ filter, role }: { filter: ProductFilter; role: Role }) {
  const [search, setSearch] = useState(filter.q)
  const [status, setStatus] = useState(filter.status)
  const [notice, setNotice] = useState('')
  const load = useCallback(() => listProducts(filter), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  function searchProducts(event: FormEvent) {
    event.preventDefault()
    window.location.hash = productListHref(search.trim(), status, 1, filter.pageSize)
    if (search.trim() === filter.q && status === filter.status && filter.page === 1) retry()
  }
  const list = result?.data
  function changed(message: string, removed: boolean) {
    setNotice(message)
    if (filter.page > 1 && list?.data.length === 1 && (removed || filter.status !== 'all')) {
      window.location.hash = productListHref(filter.q, filter.status, filter.page - 1, filter.pageSize)
    } else {
      retry()
      if (removed) requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    }
  }
  return <>
    <PageHeader title="Ürünler" description="Güncel satış fiyatları ve aktiflik durumları."
      actions={role === 'admin' ? <a className="ui-button ui-button--primary" href="#/urunler/yeni">Ürün ekle</a> : undefined} />
    {notice && <p className="product-success" role="status">{notice}</p>}
    <form className="product-filters" onSubmit={searchProducts} role="search" aria-label="Ürün arama">
      <Input label="Ürün adı" name="q" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <Select label="Durum" value={status} onChange={event => setStatus(event.target.value as ProductFilter['status'])}>
        <option value="all">Tümü</option><option value="active">Aktif</option><option value="inactive">Pasif</option>
      </Select>
      <Button type="submit" variant="secondary">Ara</Button>
    </form>
    {!result ? <LoadingState label="Ürünler yükleniyor…" /> : result.error ? <ErrorState title="Ürünler yüklenemedi" description={result.error} onRetry={retry} /> : list && <>
      {list.data.length === 0 ? <Card title="Ürün listesi"><EmptyState icon="products" title={filter.q || filter.status !== 'all' ? 'Bu filtrelerde ürün bulunamadı' : list.pagination.total === 0 ? 'Henüz ürün yok' : 'Bu sayfada ürün yok'}
        description={filter.q || filter.status !== 'all' ? 'Aramayı veya durum filtresini değiştirin.' : role === 'admin' ? 'Yeni bir ürün ekleyerek başlayabilirsiniz.' : 'Ürün eklendiğinde burada görüntülenecek.'} /></Card>
        : <div className="product-list-surface">
          <table className="product-table"><caption className="visually-hidden">Ürünler</caption>
            <thead><tr><th scope="col">Ürün adı</th><th scope="col">Güncel satış fiyatı</th><th scope="col">Durum</th><th scope="col"><span className="visually-hidden">İşlem</span></th></tr></thead>
            <tbody>{list.data.map(product => <tr key={product.id}>
              <td><a className="product-name" href={productHref(product.id)}>{product.name}</a></td>
              <td data-label="Satış fiyatı"><span className="money">{formatMoney(product.current_price_kurus)}</span></td>
              <td><Badge tone={product.is_active ? 'success' : 'neutral'}>{product.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
              <td>{role === 'admin' ? <ProductActions product={product} onChanged={changed} />
                : <a className="product-action" href={productHref(product.id)} aria-label={`${product.name} detaylarını görüntüle`}>Detay</a>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <nav className="product-pagination" aria-label="Ürün sayfaları">
        <p role="status">{list.pagination.total} ürün{list.pagination.totalPages > 0 ? ` · Sayfa ${list.pagination.page} / ${list.pagination.totalPages}` : ''}</p>
        <div>
          <Button variant="secondary" disabled={filter.page <= 1} onClick={() => { window.location.hash = productListHref(filter.q, filter.status, filter.page - 1, filter.pageSize) }}>Önceki</Button>
          <Button variant="secondary" disabled={filter.page >= list.pagination.totalPages} onClick={() => { window.location.hash = productListHref(filter.q, filter.status, filter.page + 1, filter.pageSize) }}>Sonraki</Button>
        </div>
      </nav>
    </>}
  </>
}
