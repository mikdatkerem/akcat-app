import { useEffect, useMemo, useState } from 'react'
import type { Role } from '../services/auth'
import type { Customer, CustomerFilter } from '../services/customers'
import { CustomerListPage } from './CustomerListPage'
import { CustomerRecordPage } from './CustomerRecordPage'
import { CustomerForm } from './CustomerForm'
import { customerHref, useCustomerLocation } from './routing'
import './customers.css'

export function CustomersPage({ role }: { role: Role }) {
  const hash = useCustomerLocation()
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null)
  const route = useMemo(() => {
    const [path, query] = hash.split('?')
    const parts = path.replace(/\/$/, '').split('/')
    const params = new URLSearchParams(query)
    const rawPage = Number(params.get('page') ?? 1)
    const rawSize = Number(params.get('pageSize') ?? 20)
    const status = params.get('status')
    const filter: CustomerFilter = { q: (params.get('q') ?? '').slice(0, 100), status: status === 'active' || status === 'inactive' ? status : 'all',
      page: Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1,
      pageSize: Number.isInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : 20 }
    return { kind: parts[2] === 'yeni' ? 'create' : parts[2] ? 'record' : 'list', id: parts[2], editing: parts[3] === 'duzenle', filter }
  }, [hash])
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [hash])
  function saved(customer: Customer) {
    setNotice({ id: customer.id, text: route.kind === 'create' ? 'Müşteri oluşturuldu.' : 'Müşteri bilgileri güncellendi.' })
    window.location.hash = customerHref(customer.id)
  }
  if (route.kind === 'create') return <CustomerForm role={role} onSaved={saved} />
  if (route.kind === 'record') return <CustomerRecordPage key={hash} id={route.id} editing={route.editing} role={role} onSaved={saved} notice={notice?.id === route.id ? notice.text : undefined} />
  return <CustomerListPage key={hash} filter={route.filter} role={role} />
}
