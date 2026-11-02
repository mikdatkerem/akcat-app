import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button, Icon } from '../components/ui'
export function PaymentDialog({ children, busy, close, title = 'Yeni tahsilat', closeLabel = 'Tahsilat penceresini kapat', dismissHref = '#/tahsilatlar' }: {
  children: ReactNode; busy: boolean; close: () => void; title?: string; closeLabel?: string; dismissHref?: string
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useLayoutEffect(() => {
    const dialog = ref.current!, active = document.activeElement as HTMLElement | null, overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'; dialog.showModal()
    dialog.querySelector<HTMLElement>('button')?.focus()
    return () => { dialog.close(); document.documentElement.style.overflow = overflow; if (active?.isConnected) active.focus({ preventScroll: true }) }
  }, [])
  function dismiss() { if (!busy && !ref.current?.querySelector('form[aria-busy="true"]')) close() }
  return <dialog ref={ref} className="payment-dialog" aria-labelledby={id} onCancel={e => { e.preventDefault(); dismiss() }}
    onClick={e => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dismiss() }}
    onKeyDown={e => {
      if (e.key !== 'Tab') return
      const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length)
      const first = items[0], last = items.at(-1)
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }}>
    <header className="payment-dialog-header"><h2 id={id}>{title}</h2><Button variant="ghost" disabled={busy} aria-label={closeLabel} onClick={dismiss}><Icon name="close" /></Button></header>
    <div className="payment-dialog-body" onClickCapture={e => { const link = (e.target as Element).closest<HTMLAnchorElement>('a[href]'); if (link?.getAttribute('href') === dismissHref) dismiss() }}>{children}</div>
  </dialog>
}
