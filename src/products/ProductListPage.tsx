import { useCallback, useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listProducts, type Product, type ProductFilter, type ProductList } from '../services/products'
import type { Role } from '../services/auth'
import { catalogMoney } from '../utils/catalog'
import { useResource } from '../hooks/useResource'
import { productHref, productListHref } from './routing'
import { ProductActions } from './ProductActions'
import { ProductOrderHandle } from './ProductOrderHandle'
import { useProductOrder } from './useProductOrder'

export function ProductListPage({ filter, role }: { filter: ProductFilter; role: Role }) {
  const [search, setSearch] = useState(filter.q)
  const [status, setStatus] = useState(filter.status)
  const [notice, setNotice] = useState('')
  const [inactivePage, setInactivePage] = useState(1)
  const passivePage = filter.status === 'inactive' ? filter.page : inactivePage
  const load = useCallback(() => filter.status === 'inactive' ? Promise.resolve(null) : listProducts({ ...filter, status: 'active' }), [filter])
  const { result, retry } = useResource(JSON.stringify(filter), load)
  const loadInactive = useCallback(() => filter.status === 'active' ? Promise.resolve(null) : listProducts({ ...filter, status: 'inactive', page: passivePage }), [filter, passivePage])
  const { result: inactiveResult, retry: retryInactive } = useResource(`${JSON.stringify(filter)}:${passivePage}`, loadInactive)
  const refresh = () => { retry(); retryInactive() }
  function searchProducts(event: FormEvent) {
    event.preventDefault()
    window.location.hash = productListHref(search.trim(), status, 1, filter.pageSize)
    if (search.trim() === filter.q && status === filter.status && filter.page === 1) { setInactivePage(1); refresh() }
  }
  const list = result?.data
  const order = useProductOrder(list ?? undefined, role === 'admin', () => { setNotice('Ürün sırası güncellendi.'); refresh() })
  function changed(message: string, removed: boolean, inactive: boolean) {
    setNotice(message)
    const currentPage = inactive ? passivePage : filter.page
    const currentList = inactive ? inactiveResult?.data : list
    if (currentPage > 1 && currentList?.data.length === 1 && (!inactive || filter.status === 'inactive')) {
      window.location.hash = productListHref(filter.q, filter.status, filter.page - 1, filter.pageSize)
    } else {
      if (inactive && currentPage > 1 && currentList?.data.length === 1) setInactivePage(currentPage - 1)
      refresh()
      if (removed) requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    }
  }
  function table(data: Product[], inactive: boolean) {
    return <div className="product-list-surface">
      <table className="product-table"><caption className="visually-hidden">{inactive ? 'Pasif ürünler' : 'Aktif ürünler'}</caption>
        <thead><tr><th scope="col">Ürün adı</th><th scope="col">Güncel satış fiyatı</th><th scope="col">Durum</th><th scope="col"><span className="visually-hidden">İşlem</span></th></tr></thead>
        <tbody>{data.map(product => <tr key={product.id} data-product-id={inactive ? undefined : product.id}
          data-order-source={!inactive && order.drag?.active && order.drag.id === product.id || undefined}
          data-order-target={!inactive && order.drag?.target === product.id ? order.drag.placement : undefined}>
          <td><a className="product-name" href={productHref(product.id)}>{product.name}</a></td>
          <td data-label="Satış fiyatı"><span className="money">{catalogMoney(product.current_price_kurus)}</span></td>
          <td><Badge tone={product.is_active ? 'success' : 'neutral'}>{product.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
          <td><div className="product-row-actions">{!inactive && role === 'admin' && <ProductOrderHandle id={product.id} name={product.name} order={order} />}
            <ProductActions showActivate={inactive} disabled={order.locked} product={product} role={role} onChanged={(message, removed) => changed(message, removed, inactive)} /></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  }
  function pagination(value: ProductList, inactive: boolean) {
    if (value.pagination.totalPages <= 1) return null
    return <nav className="product-pagination" aria-label={inactive ? 'Pasif ürün sayfaları' : 'Aktif ürün sayfaları'}>
      <p role="status">{value.pagination.total} ürün · Sayfa {value.pagination.page} / {value.pagination.totalPages}</p>
      <div>{([-1,1] as const).map(step => <Button key={step} variant="secondary" disabled={value.pagination.page + step < 1 || value.pagination.page + step > value.pagination.totalPages} onClick={() => {
        if (inactive && filter.status !== 'inactive') setInactivePage(value.pagination.page + step)
        else window.location.hash = productListHref(filter.q, filter.status, value.pagination.page + step, filter.pageSize)
      }}>{step === -1 ? 'Önceki' : 'Sonraki'}</Button>)}</div>
    </nav>
  }
  return <>
    <PageHeader title="Ürünler" description="Güncel satış fiyatları ve aktiflik durumları."
      actions={role === 'admin' ? <a className="ui-button ui-button--primary" href="#/urunler/yeni">Ürün ekle</a> : undefined} />
    {notice && <p className="product-success" role="status">{notice}</p>}
    {order.error && <div className="product-action-error" role="alert"><p>{order.error}</p>
      {order.pending && <Button variant="secondary" disabled={order.busy} onClick={order.retry}>Aynı sıralamayı tekrar dene</Button>}
      <Button variant="ghost" disabled={order.busy} onClick={() => { setNotice(''); refresh() }}>Listeyi yenile</Button>
    </div>}
    {order.busy && <p role="status">Ürün sırası kaydediliyor…</p>}
    <form className="product-filters" onSubmit={searchProducts} role="search" aria-label="Ürün arama">
      <Input label="Ürün adı" name="q" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <Select label="Durum" value={status} onChange={event => setStatus(event.target.value as ProductFilter['status'])}>
        <option value="all">Tümü</option><option value="active">Aktif</option><option value="inactive">Pasif</option>
      </Select>
      <Button type="submit" variant="primary">Ara</Button>
    </form>
    {filter.status !== 'inactive' && <section className="product-status-section" aria-labelledby="active-products-title">
      <h2 id="active-products-title">Aktif Ürünler</h2>
      {!result ? <LoadingState label="Aktif ürünler yükleniyor…" /> : result.error ? <ErrorState title="Ürünler yüklenemedi" description={result.error} onRetry={retry} /> : list && <>
        {list.data.length ? table(list.data, false) : <Card title="Aktif ürün listesi"><EmptyState icon="products" title={filter.q ? 'Bu filtrelerde aktif ürün bulunamadı' : list.pagination.total ? 'Bu sayfada aktif ürün yok' : inactiveResult?.data?.pagination.total === 0 ? 'Henüz ürün yok' : 'Aktif ürün bulunamadı'} description="Aramayı değiştirebilir veya pasif ürünleri kontrol edebilirsiniz." /></Card>}
        {pagination(list, false)}
      </>}
    </section>}
    {filter.status !== 'active' && (!inactiveResult ? <LoadingState label="Pasif ürünler yükleniyor…" /> : inactiveResult.error ? <ErrorState title="Pasif ürünler yüklenemedi" description={inactiveResult.error} onRetry={retryInactive} /> : inactiveResult.data && (inactiveResult.data.pagination.total > 0 || filter.status === 'inactive') && <section className="product-status-section" aria-labelledby="inactive-products-title">
      <h2 id="inactive-products-title">Pasif Ürünler</h2>
      {inactiveResult.data.data.length ? table(inactiveResult.data.data, true) : <Card title="Pasif ürün listesi"><EmptyState icon="products" title="Bu sayfada pasif ürün bulunamadı" description="Aramayı veya sayfa seçimini değiştirin." /></Card>}
      {pagination(inactiveResult.data, true)}
    </section>)}
  </>
}
