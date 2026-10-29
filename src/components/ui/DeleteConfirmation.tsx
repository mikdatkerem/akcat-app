import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

// Shared product/customer/account deletion dialog; native modal handles focus trapping.
export function DeleteConfirmation({ title, description, busy, close, confirm, children }: {
  title: string; description: string; busy: boolean; close: () => void; confirm: () => void; children: ReactNode
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
  return <dialog ref={ref} className="ui-delete-dialog" aria-labelledby={id} aria-describedby={`${id}-description`} aria-busy={busy}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
    onCancel={event => { event.preventDefault(); if (!busy) close() }} onClick={event => {
      if (busy || event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
    }}>
    <h2 id={id}>{title}</h2>
    <p id={`${id}-description`}>{description}</p>
    {children}
    <div className="ui-delete-dialog-actions">
      <Button variant="secondary" disabled={busy} onClick={close}>Vazgeç</Button>
      <Button variant="danger" loading={busy} loadingText="Siliniyor…" onClick={confirm}><Icon name="trash" />Kalıcı olarak sil</Button>
    </div>
  </dialog>
}
