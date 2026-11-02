import { useEffect, useMemo, useState } from 'react'
import { validDay } from '../utils/day'
import { useIstanbulToday } from '../finance/useIstanbulToday'
import { ErrorState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import type { Sale, SaleFilter } from '../services/sales'
import type { Role } from '../services/auth'
import { SaleForm } from './SaleForm'
import { SaleRecord } from './SaleRecord'
import { SaleListPage } from './SaleListPage'
import { saleHref, useSaleLocation } from './routing'
import './sales.css'
import '../finance/finance.css'

export function SalesPage({ userId, role }: { userId: string; role: Role }) {
  const hash = useSaleLocation(), today = useIstanbulToday()
  const [receipt, setReceipt] = useState<Sale | undefined>()
  const route = useMemo(() => {
    const [path, query] = hash.split('?'), params = new URLSearchParams(query)
    const page = Number(params.get('page') ?? 1), pageSize = Number(params.get('pageSize') ?? 20)
    const filter: SaleFilter = { page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 20 }
    for (const key of ['customer_id', 'from', 'to', 'day', 'status', 'q', 'start_date', 'end_date'] as const) if (params.get(key)) filter[key] = params.get(key)!
    if (!filter.from && !filter.to && !filter.start_date && !filter.end_date && !filter.day) filter.day = today
    for (const field of ['day', 'start_date', 'end_date'] as const) if (filter[field] && validDay(filter[field]) && filter[field] > today) filter[field] = today
    const start = Date.parse(today + 'T00:00:00+03:00'), end = start + 86400000
    if (filter.from && Date.parse(filter.from) >= end) filter.from = new Date(start).toISOString()
    if (filter.to && Date.parse(filter.to) > end) filter.to = new Date(end).toISOString()
    const invalid = [filter.day,filter.start_date,filter.end_date].some(d => d && !validDay(d)) || (filter.customer_id && !/^[a-f0-9-]{36}$/i.test(filter.customer_id))
      || [filter.from, filter.to].some(value => value && !Number.isFinite(Date.parse(value)))
    const requestedMode: 'normal' | 'walk_in' | undefined = params.get('mode') === 'walk_in' ? 'walk_in' : params.get('mode') === 'normal' ? 'normal' : undefined
    return { create: path === '#/yeni-satis' || path === '#/satislar/yeni', id: path.replace(/\/$/, '').split('/')[2], filter, invalid, requestedMode }
  }, [hash, today])
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [hash, today])
  if (route.create) return <SaleForm key={`${userId}:${route.requestedMode ?? 'resume'}`} actor={userId} requestedMode={route.requestedMode} onSaved={sale => { setReceipt(sale); window.location.hash = saleHref(sale.id) }} />
  if (route.id) return <SaleRecord key={hash} id={route.id} actor={userId} receipt={receipt?.id === route.id ? receipt : undefined} />
  if (route.invalid) return <><PageHeader title="Satışlar" description="Filtre adresi geçerli değil." /><ErrorState title="Filtreler uygulanamadı" description="Müşteri ve tarih değerlerini kontrol edin." /><a className="text-link" href="#/satislar">Filtreleri temizle</a></>
  return <SaleListPage key={hash + today} filter={route.filter} role={role} />
}
