import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import type { Sale, SaleFilter } from '../services/sales'
import type { Role } from '../services/auth'
import { SaleForm } from './SaleForm'
import { SaleRecord } from './SaleRecord'
import { SaleListPage } from './SaleListPage'
import { saleHref, useSaleLocation } from './routing'
import './sales.css'

export function SalesPage({ userId, role }: { userId: string; role: Role }) {
  const hash = useSaleLocation()
  const [receipt, setReceipt] = useState<Sale | undefined>()
  const route = useMemo(() => {
    const [path, query] = hash.split('?'), params = new URLSearchParams(query)
    const page = Number(params.get('page') ?? 1), pageSize = Number(params.get('pageSize') ?? 20)
    const filter: SaleFilter = { page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 20 }
    for (const key of ['customer_id', 'from', 'to'] as const) if (params.get(key)) filter[key] = params.get(key)!
    const invalid = (filter.customer_id && !/^[a-f0-9-]{36}$/i.test(filter.customer_id))
      || [filter.from, filter.to].some(value => value && !Number.isFinite(Date.parse(value)))
    return { create: path === '#/yeni-satis' || path === '#/satislar/yeni', id: path.replace(/\/$/, '').split('/')[2], filter, invalid }
  }, [hash])
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [hash])
  if (route.create) return <SaleForm key={userId} actor={userId} onSaved={sale => { setReceipt(sale); window.location.hash = saleHref(sale.id) }} />
  if (route.id) return <SaleRecord key={hash} id={route.id} actor={userId} receipt={receipt?.id === route.id ? receipt : undefined} />
  if (route.invalid) return <><PageHeader title="Satışlar" description="Filtre adresi geçerli değil." /><ErrorState title="Filtreler uygulanamadı" description="Müşteri ve tarih değerlerini kontrol edin." /><a className="text-link" href="#/satislar">Filtreleri temizle</a></>
  return <SaleListPage key={hash} filter={route.filter} role={role} />
}
