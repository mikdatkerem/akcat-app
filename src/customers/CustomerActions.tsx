import { useEffect, useRef, useState } from 'react'
import { ActionMenu, DeleteConfirmation, Icon } from '../components/ui'
import { ApiError } from '../services/apiClient'
import type { Role } from '../services/auth'
import { deleteCustomer, updateCustomer, type Customer } from '../services/customers'
import { customerHref } from './routing'

export function CustomerActions({ customer, role, onChanged }: { customer: Customer; role: Role; onChanged: (message: string, removed: boolean) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const statusKey = useRef(crypto.randomUUID()), deleteKey = useRef<string | null>(null)
  const sending = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function mutate(remove: boolean) {
    if (sending.current || role !== 'admin') return
    sending.current = true; setBusy(true); setError('')
    try {
      if (remove) { deleteKey.current ??= crypto.randomUUID(); await deleteCustomer(customer.id, deleteKey.current) }
      else await updateCustomer(customer.id, { is_active: !customer.is_active }, customer.version, statusKey.current)
      if (mounted.current) {
        setConfirming(false)
        onChanged(remove ? 'Müşteri kalıcı olarak silindi.' : customer.is_active ? 'Müşteri pasife alındı; yeni satış seçiminde gösterilmez.' : 'Müşteri yeniden aktifleştirildi.', remove)
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'İşlem sonucu doğrulanamadı. Aynı işlemi tekrar deneyin veya listeyi yenileyin.')
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <div className="customer-row-actions" onClick={event => event.stopPropagation()}>
    <ActionMenu label={`${customer.name} müşteri işlemleri`} triggerClassName="customer-more" menuClassName="customer-action-popover" disabled={busy}>
      <a role="menuitem" tabIndex={-1} href={customerHref(customer.id)}>Müşteriyi Görüntüle</a>
      <a role="menuitem" tabIndex={-1} href={customerHref(customer.id) + '/duzenle'}>Düzenle</a>
      {role === 'admin' && <>
        <button role="menuitem" tabIndex={-1} type="button" onClick={() => { void mutate(false) }}>{customer.is_active ? 'Pasife al' : 'Aktifleştir'}</button>
        <button role="menuitem" tabIndex={-1} type="button" className="ui-action-menu__danger" onClick={() => { setError(''); setConfirming(true) }}><Icon name="trash" width="18" height="18" />Sil</button>
      </>}
    </ActionMenu>
    {busy && !confirming && <span className="visually-hidden" role="status">Müşteri durumu güncelleniyor…</span>}
    {error && !confirming && <p className="record-action-error" role="alert">{error}</p>}
    {confirming && <DeleteConfirmation title="Müşteri kalıcı olarak silinsin mi?"
      description="Yalnızca geçmiş işlem kaydı olmayan müşteriler silinebilir. Geçmişi korumak için müşteriyi pasife alabilirsiniz. Silme işlemi geri alınamaz."
      busy={busy} close={() => setConfirming(false)} confirm={() => { void mutate(true) }}>
      <p className="ui-delete-name"><strong>{customer.name}</strong></p>
      {error && <p className="record-action-error" role="alert">{error}</p>}
    </DeleteConfirmation>}
  </div>
}
