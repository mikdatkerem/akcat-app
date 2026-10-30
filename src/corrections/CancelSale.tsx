import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { cancelSale } from '../services/corrections'
import type { Sale } from '../services/sales'
import { ReasonForm } from './ReasonForm'

function CancelDialog({ sale, actor, close, onSaved }: { sale: Sale; actor: string; close: () => void; onSaved: () => void }) {
  const busy = useRef(false)
  const guardedClose = () => { if (!busy.current) close() }
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null, element = dialog.current!
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'; element.showModal()
    element.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    return () => { element.close(); document.documentElement.style.overflow = overflow; if (active?.isConnected) active.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="correction-dialog" aria-labelledby="cancel-title" aria-describedby="cancel-description"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); guardedClose() }} onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) guardedClose()
    }}>
    <h2 id="cancel-title">Satışı iptal et</h2>
    <p id="cancel-description">{sale.customer.name} için bu satışın borcu kapatılacak. Satış, ürünler ve işlem geçmişi korunacak. Bu işlem geri alınamaz.</p>
    <ReasonForm actor={actor} scope={'cancel:' + sale.id} label="İptali Onayla" danger
      send={(body, key) => cancelSale(sale.id, body, key)} onClose={guardedClose} onBusyChange={value => { busy.current = value }} onSaved={onSaved} />
  </dialog>
}
export function CancelSale({ sale, actor, onSaved }: { sale: Sale; actor: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  return <>
    <p className="sale-help">{sale.cancellation_eligibility.explanation}</p>
    {sale.cancellation_eligibility.allowed && <Button variant="danger" onClick={() => setOpen(true)}>Satışı İptal Et</Button>}
    {open && <CancelDialog sale={sale} actor={actor} close={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved() }} />}
  </>
}
