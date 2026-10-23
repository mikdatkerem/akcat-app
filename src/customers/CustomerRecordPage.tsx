import { useCallback } from 'react'
import { Badge, Card, ErrorState, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getCustomer, type Customer } from '../services/customers'
import type { Role } from '../services/auth'
import { CustomerForm } from './CustomerForm'
import { customerHref } from './routing'
import { useResource } from '../hooks/useResource'
import { CustomerAccount } from '../finance/CustomerAccount'
import { CustomerLedger } from '../finance/CustomerLedger'
import { DirectionsLink } from '../components/DirectionsLink'

const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' })
export function CustomerRecordPage({ id, editing, role, notice, onSaved }: { id: string; editing: boolean; role: Role; notice?: string; onSaved: (value: Customer) => void }) {
  const load = useCallback(() => getCustomer(id), [id])
  const { result, retry } = useResource(id, load)
  if (!result) return <><PageHeader title="Müşteri" description="Müşteri bilgileri yükleniyor." /><LoadingState label="Müşteri yükleniyor…" /></>
  if (result.error || !result.data) return <><PageHeader title="Müşteri" description="Müşteri bilgileri alınamadı." /><ErrorState title="Müşteri görüntülenemedi" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} /><a className="text-link" href="#/musteriler">Müşteri listesine dön</a></>
  const customer = result.data
  if (editing) return <CustomerForm key={id} customer={customer} role={role} onSaved={onSaved} />
  return <>
    <PageHeader title={customer.name} description="İletişim ve teslimat bilgileri."
      actions={<a className="ui-button ui-button--primary" href={customerHref(id) + '/duzenle'}>Bilgileri düzenle</a>} />
    {notice && <p className="customer-success" role="status">{notice}</p>}
    <Card title="Müşteri bilgileri" accessory={<Badge tone={customer.is_active ? 'success' : 'neutral'}>{customer.is_active ? 'Aktif' : 'Pasif'}</Badge>}>
      <dl className="customer-details">
        <div><dt>Müşteri adı</dt><dd>{customer.name}</dd></div>
        <div><dt>Telefon</dt><dd>{customer.phone || 'Belirtilmedi'}</dd></div>
        <div><dt>Adres</dt><dd className="customer-multiline">{customer.address || 'Belirtilmedi'}<DirectionsLink address={customer.address} /></dd></div>
        <div><dt>Teslimat notu</dt><dd className="customer-multiline">{customer.delivery_notes || 'Teslimat notu yok.'}</dd></div>
        <div><dt>Oluşturulma</dt><dd><time dateTime={customer.created_at}>{date.format(new Date(customer.created_at))}</time></dd></div>
        <div><dt>Son güncelleme</dt><dd><time dateTime={customer.updated_at}>{date.format(new Date(customer.updated_at))}</time></dd></div>
      </dl>
    </Card>
    <div className="finance-customer-panels"><CustomerAccount id={id} /><CustomerLedger id={id} /></div>
    <a className="text-link" href="#/musteriler">Müşteri listesine dön</a>
  </>
}
