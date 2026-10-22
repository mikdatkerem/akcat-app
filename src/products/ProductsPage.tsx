import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Card, ErrorState, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import type { Role } from '../services/auth'
import { getProduct, type Product, type ProductFilter } from '../services/products'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { ProductForm } from './ProductForm'
import { ProductListPage } from './ProductListPage'
import { productHref, useProductLocation } from './routing'
import './products.css'

const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' })
function ProductRecord({ id, editing, role, notice, onSaved }: { id: string; editing: boolean; role: Role; notice?: string; onSaved: (product: Product) => void }) {
  const load = useCallback(() => getProduct(id), [id])
  const { result, retry } = useResource(id, load)
  if (!result) return <><PageHeader title="Ürün" description="Ürün bilgileri yükleniyor." /><LoadingState label="Ürün yükleniyor…" /></>
  if (result.error || !result.data) return <><PageHeader title="Ürün" description="Ürün bilgileri alınamadı." /><ErrorState title="Ürün görüntülenemedi" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} /><a className="text-link" href="#/urunler">Ürün listesine dön</a></>
  const product = result.data
  if (editing && role === 'admin') return <ProductForm product={product} onSaved={onSaved} />
  return <>
    <PageHeader title={product.name} description="Güncel ürün bilgileri."
      actions={role === 'admin' ? <a className="ui-button ui-button--primary" href={productHref(id) + '/duzenle'}>Ürünü düzenle</a> : undefined} />
    {notice && <p className="product-success" role="status">{notice}</p>}
    <Card title="Ürün bilgileri" accessory={<Badge tone={product.is_active ? 'success' : 'neutral'}>{product.is_active ? 'Aktif' : 'Pasif'}</Badge>}>
      <dl className="product-details">
        <div><dt>Ürün adı</dt><dd>{product.name}</dd></div>
        <div><dt>Güncel satış fiyatı</dt><dd className="money">{formatMoney(product.current_price_kurus)}</dd></div>
        <div><dt>Oluşturulma</dt><dd><time dateTime={product.created_at}>{date.format(new Date(product.created_at))}</time></dd></div>
        <div><dt>Son güncelleme</dt><dd><time dateTime={product.updated_at}>{date.format(new Date(product.updated_at))}</time></dd></div>
      </dl>
    </Card>
    <a className="text-link" href="#/urunler">Ürün listesine dön</a>
  </>
}
export function ProductsPage({ role }: { role: Role }) {
  const hash = useProductLocation()
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null)
  const route = useMemo(() => {
    const [path, query] = hash.split('?')
    const parts = path.replace(/\/$/, '').split('/')
    const params = new URLSearchParams(query)
    const rawPage = Number(params.get('page') ?? 1)
    const rawSize = Number(params.get('pageSize') ?? 20)
    const status = params.get('status')
    const filter: ProductFilter = { q: (params.get('q') ?? '').slice(0, 100), status: status === 'active' || status === 'inactive' ? status : 'all',
      page: Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1,
      pageSize: Number.isInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : 20 }
    return { kind: parts[2] === 'yeni' ? 'create' : parts[2] ? 'record' : 'list', id: parts[2], editing: parts[3] === 'duzenle', filter }
  }, [hash])
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [hash])
  function saved(product: Product) {
    setNotice({ id: product.id, text: route.kind === 'create' ? 'Ürün oluşturuldu.' : 'Ürün bilgileri güncellendi.' })
    window.location.hash = productHref(product.id)
  }
  if ((route.kind === 'create' || route.editing) && role !== 'admin') return <>
    <PageHeader title="Erişim izni gerekli" description="Ürünleri yalnızca yöneticiler oluşturabilir ve düzenleyebilir." />
    <a className="text-link" href="#/urunler">Ürün listesine dön</a>
  </>
  if (route.kind === 'create') return <ProductForm onSaved={saved} />
  if (route.kind === 'record') return <ProductRecord key={hash} id={route.id} editing={route.editing} role={role} onSaved={saved} notice={notice?.id === route.id ? notice.text : undefined} />
  return <ProductListPage key={hash} filter={route.filter} role={role} />
}
