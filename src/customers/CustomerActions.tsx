import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { DeleteRecordAction } from '../components/DeleteRecordAction'
import { ApiError } from '../services/apiClient'
import { deleteCustomer, updateCustomer, type Customer } from '../services/customers'
import { customerHref } from './routing'

export function CustomerActions({ customer, onChanged }: { customer: Customer; onChanged: (message: string, removed: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const statusKey = useRef(crypto.randomUUID())
  const sending = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function toggleStatus() {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      await updateCustomer(customer.id, { is_active: !customer.is_active }, customer.version, statusKey.current)
      if (mounted.current) onChanged(customer.is_active ? 'Müşteri pasife alındı; yeni satış seçiminde gösterilmez.' : 'Müşteri yeniden aktifleştirildi.', false)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'Müşteri durumu doğrulanamadı. Listeyi yenileyin.')
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <details className="record-actions-menu" onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() }
  }}><summary aria-label={`${customer.name} müşteri işlemleri`}>İşlemler</summary>
    <div className="record-actions-options">
      <a className="ui-button ui-button--ghost" href={customerHref(customer.id)}>Detay</a>
      <a className="ui-button ui-button--ghost" href={customerHref(customer.id) + '/duzenle'}>Düzenle</a>
      <Button variant="ghost" loading={busy} onClick={() => { void toggleStatus() }}>{customer.is_active ? 'Pasife al' : 'Aktifleştir'}</Button>
      <DeleteRecordAction recordName={customer.name} title="Müşteri kalıcı olarak silinsin mi?"
        description="Yalnızca geçmiş işlem kaydı olmayan müşteriler silinebilir. Geçmişi korumak için müşteriyi pasife alabilirsiniz. Silme işlemi geri alınamaz."
        disabledReason={busy ? 'Müşteri durumu güncelleniyor.' : undefined}
        remove={key => deleteCustomer(customer.id, key)} onDeleted={() => onChanged('Müşteri kalıcı olarak silindi.', true)} />
    </div>
    {error && <p className="record-action-error" role="alert">{error}</p>}
  </details>
}
