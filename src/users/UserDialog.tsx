import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '../components/ui'

export function UserDialog({ title, children, busy, close, confirm, label }: { title: string; children: ReactNode; busy: boolean; close: () => void; confirm: () => void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useLayoutEffect(() => {
    const dialog = ref.current!, active = document.activeElement as HTMLElement | null, overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'; dialog.showModal(); dialog.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { dialog.close(); document.documentElement.style.overflow = overflow; if (active?.isConnected) active.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="user-dialog" aria-labelledby={id} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) close() }} onClick={event => {
      if (busy || event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
    }}>
    <h2 id={id}>{title}</h2>{children}
    <div className="user-actions"><Button variant="secondary" disabled={busy} onClick={close}>Vazgeç</Button>
      <Button variant="danger" loading={busy} loadingText="Kaydediliyor…" onClick={confirm}>{label}</Button></div>
  </dialog>
}
