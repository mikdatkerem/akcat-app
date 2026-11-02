import { useEffect, useRef, useState } from 'react'
import { ActionMenu, Button, DeleteConfirmation, Icon } from '../components/ui'
import { ApiError } from '../services/apiClient'
import type { Role } from '../services/auth'
import { deleteProduct, updateProduct, type Product } from '../services/products'
import { productHref } from './routing'

export function ProductActions({ product, role, disabled = false, showActivate = false, onChanged }: { disabled?: boolean; showActivate?: boolean; product: Product; role: Role; onChanged: (message: string, removed: boolean) => void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState<'status' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const statusKey = useRef(crypto.randomUUID())
  const sending = useRef(false), mounted = useRef(false), deleteKey = useRef<string | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function run(kind: 'status' | 'delete') {
    if (disabled || sending.current || role !== 'admin') return
    sending.current = true; setBusy(kind); setError('')
    try {
      if (kind === 'delete') {
        // Keep the same key after a lost response, including closing/reopening this confirmation.
        deleteKey.current ??= crypto.randomUUID()
        await deleteProduct(product.id, deleteKey.current)
      } else await updateProduct(product.id, { is_active: !product.is_active }, product.version, statusKey.current)
      if (mounted.current) {
        setConfirming(false)
        onChanged(kind === 'delete' ? 'Ürün kalıcı olarak silindi.' : product.is_active ? 'Ürün pasife alındı.' : 'Ürün aktifleştirildi.', kind === 'delete')
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'İşlem sonucu doğrulanamadı. Aynı işlemi tekrar deneyin veya listeyi yenileyin.')
    } finally {
      sending.current = false
      if (mounted.current) setBusy(null)
    }
  }
  return <>
    {showActivate && !product.is_active && role === 'admin' && <Button variant="secondary" disabled={disabled || !!busy} loading={busy === 'status'} loadingText="Aktifleştiriliyor…" onClick={() => { void run('status') }}>Aktif hale getir</Button>}
    <ActionMenu label={`${product.name} ürün işlemleri`} triggerClassName="product-more" disabled={disabled || !!busy}>
      <a role="menuitem" tabIndex={-1} href={productHref(product.id)}>Ürünü Görüntüle</a>
      {role === 'admin' && <>
        <a role="menuitem" tabIndex={-1} href={productHref(product.id) + '/duzenle'}>Düzenle</a>
        {(!showActivate || product.is_active) && <button role="menuitem" tabIndex={-1} type="button" onClick={() => { void run('status') }}>{product.is_active ? 'Pasife al' : 'Aktifleştir'}</button>}
        <button role="menuitem" tabIndex={-1} type="button" className="ui-action-menu__danger" onClick={() => { setError(''); setConfirming(true) }}><Icon name="trash" width="18" height="18" />Sil</button>
      </>}
    </ActionMenu>
    {!confirming && error && <p className="product-action-error" role="alert">{error}</p>}
    {confirming && <DeleteConfirmation title="Ürün kalıcı olarak silinsin mi?" description="Yalnızca geçmiş satışlarda kullanılmamış ürünler silinebilir. Bu işlem geri alınamaz."
      busy={busy === 'delete'} close={() => setConfirming(false)} confirm={() => { void run('delete') }}>
      <p className="product-delete-name"><strong>{product.name}</strong></p>
      {error && <p className="product-action-error" role="alert">{error}</p>}
    </DeleteConfirmation>}
  </>
}
