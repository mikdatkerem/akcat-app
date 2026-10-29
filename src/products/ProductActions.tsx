import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Icon } from '../components/ui'
import { ApiError } from '../services/apiClient'
import { deleteProduct, updateProduct, type Product } from '../services/products'
import { productHref } from './routing'

function DeleteConfirmation({ busy, close, confirm, children }: {
  busy: boolean; close: () => void; confirm: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useLayoutEffect(() => {
    const dialog = ref.current!, active = document.activeElement as HTMLElement | null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      dialog.close()
      document.documentElement.style.overflow = overflow
      const target = active?.isConnected ? active : document.getElementById('main-content')
      target?.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className="product-delete-dialog" aria-labelledby={id} aria-describedby={`${id}-description`} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) close() }} onClick={event => {
      if (busy || event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
    }}>
    <h2 id={id}>Ürün kalıcı olarak silinsin mi?</h2>
    <p id={`${id}-description`}>Yalnızca geçmiş satışlarda kullanılmamış ürünler silinebilir. Bu işlem geri alınamaz.</p>
    {children}
    <div className="product-form-actions">
      <Button variant="secondary" disabled={busy} onClick={close}>Vazgeç</Button>
      <Button variant="danger" loading={busy} loadingText="Siliniyor…" onClick={confirm}><Icon name="trash" />Kalıcı olarak sil</Button>
    </div>
  </dialog>
}

export function ProductActions({ product, onChanged }: { product: Product; onChanged: (message: string, removed: boolean) => void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState<'status' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const sending = useRef(false), mounted = useRef(false), deleteKey = useRef<string | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function run(kind: 'status' | 'delete') {
    if (sending.current) return
    sending.current = true; setBusy(kind); setError('')
    try {
      if (kind === 'delete') {
        // Keep the same key after a lost response, including closing/reopening this confirmation.
        deleteKey.current ??= crypto.randomUUID()
        await deleteProduct(product.id, deleteKey.current)
      } else await updateProduct(product.id, { is_active: !product.is_active })
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
    <details className="product-actions-menu" onKeyDown={event => {
      if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() }
    }}>
      <summary aria-label={`${product.name} ürün işlemleri`}>İşlemler</summary>
      <div className="product-actions-options" aria-busy={!!busy}>
        <a className="ui-button ui-button--ghost" href={productHref(product.id) + '/duzenle'}>Düzenle</a>
        <Button variant="ghost" disabled={!!busy} loading={busy === 'status'} onClick={() => { void run('status') }}>
          {product.is_active ? 'Pasife al' : 'Aktifleştir'}
        </Button>
        <Button variant="danger" disabled={!!busy} onClick={() => { setError(''); setConfirming(true) }}><Icon name="trash" />Sil</Button>
      </div>
      {!confirming && error && <p className="product-action-error" role="alert">{error}</p>}
    </details>
    {confirming && <DeleteConfirmation busy={busy === 'delete'} close={() => setConfirming(false)} confirm={() => { void run('delete') }}>
      <p className="product-delete-name"><strong>{product.name}</strong></p>
      {error && <p className="product-action-error" role="alert">{error}</p>}
    </DeleteConfirmation>}
  </>
}
