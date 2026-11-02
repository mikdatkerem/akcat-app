import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { reorderProduct, type ProductList, type ProductMove } from '../services/products'
type Drag = { id: string; pointer: number; x: number; y: number; active: boolean; target: string | null; placement: 'before' | 'after' }
type Attempt = { id: string; move: ProductMove; version: number; key: string }
export function useProductOrder(list: ProductList | undefined, enabled: boolean, saved: () => void) {
  const [drag, setDrag] = useState<Drag | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [pending, setPending] = useState<Attempt | null>(null)
  const pointer = useRef<Drag | null>(null), sending = useRef(false), mounted = useRef(false), suppressClick = useRef(false), focus = useRef<string | null>(null)
  const preview = useRef<{ element: HTMLDivElement; offsetX: number; offsetY: number } | null>(null)
  const clearPreview = useCallback(() => { preview.current?.element.remove(); preview.current = null }, [])
  const cancel = useCallback(() => { clearPreview(); pointer.current = null; setDrag(null); document.body.classList.remove('product-dragging') }, [clearPreview])
  useEffect(() => {
    mounted.current = true
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && pointer.current) { suppressClick.current = pointer.current.active; cancel() } }
    window.addEventListener('keydown', escape)
    return () => { clearPreview(); mounted.current = false; pointer.current = null; document.body.classList.remove('product-dragging'); window.removeEventListener('keydown', escape) }
  }, [cancel, clearPreview])
  useEffect(() => {
    if (!list || !focus.current) return
    const row = document.querySelector<HTMLElement>(`[data-product-id="${focus.current}"] .product-order-handle`)
    row?.focus({ preventScroll: true }); focus.current = null
  }, [list])
  async function run(id: string, move: ProductMove, retry?: Attempt) {
    if (!enabled || !list || sending.current || (pending && !retry)) return
    const attempt = retry ?? { id, move, version: list.order_version, key: crypto.randomUUID() }
    sending.current = true; setBusy(true); setError(''); setPending(attempt)
    try {
      await reorderProduct(attempt.id, attempt.move, attempt.version, attempt.key)
      if (mounted.current) { setPending(null); focus.current = attempt.id; saved() }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Sıralama kaydedilemedi.')
        if (cause instanceof ApiError && [400,403,404,409,413,415,422,428].includes(cause.status)) setPending(null)
      }
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  function start(id: string, event: PointerEvent<HTMLButtonElement>) {
    if (!enabled || busy || pending || !list || list.data.length < 2 || event.button !== 0) return
    suppressClick.current = false
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    pointer.current = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, active: false, target: null, placement: 'before' }
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current
    if (!current || current.pointer !== event.pointerId) return
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return
    event.preventDefault()
    if (!current.active) {
      const popup = event.currentTarget.closest('.ui-action-menu')?.querySelector<HTMLElement>('[popover]')
      if (popup?.matches(':popover-open')) popup.hidePopover()
      const source = event.currentTarget.closest<HTMLTableRowElement>('[data-product-id]')
      if (source) {
        const rect = source.getBoundingClientRect(), clone = source.cloneNode(true) as HTMLTableRowElement
        clone.removeAttribute('data-product-id'); clone.removeAttribute('data-order-source'); clone.removeAttribute('data-order-target')
        for (const node of clone.querySelectorAll('[id]')) node.removeAttribute('id')
        for (const node of clone.querySelectorAll('[popover]')) node.remove()
        const element = document.createElement('div'), table = document.createElement('table'), body = document.createElement('tbody')
        element.className = 'product-drag-preview'; element.setAttribute('aria-hidden', 'true'); element.inert = true
        element.style.width = `${rect.width}px`
        table.className = 'product-table'
        // Preserve desktop column geometry; on mobile the existing grid rules still apply.
        if (getComputedStyle(source).display === 'table-row') {
          Array.from(clone.cells).forEach((cell, index) => { cell.style.width = `${source.cells[index].getBoundingClientRect().width}px` })
        }
        body.append(clone); table.append(body); element.append(table); document.body.append(element)
        preview.current = { element, offsetX: current.x - rect.left, offsetY: current.y - rect.top }
      }
    }
    if (preview.current) preview.current.element.style.transform = `translate3d(${event.clientX - preview.current.offsetX}px, ${event.clientY - preview.current.offsetY}px, 0)`
    current.active = true; suppressClick.current = true
    document.body.classList.add('product-dragging')
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-product-id]')
    const target = row?.dataset.productId
    current.target = target && target !== current.id && list?.data.some(p => p.id === target) ? target : null
    if (row) current.placement = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? 'before' : 'after'
    if (event.clientY < 90) window.scrollBy({ top: -16, behavior: 'instant' })
    else if (event.clientY > window.innerHeight - 70) window.scrollBy({ top: 16, behavior: 'instant' })
    setDrag({ ...current })
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current
    if (!current || current.pointer !== event.pointerId) return
    cancel()
    if (current.active && current.target) void run(current.id, { target_id: current.target, placement: current.placement })
  }
  return { drag, busy, error, pending, locked: busy || !!pending, start, move, end,
    cancel: () => { suppressClick.current = true; cancel() },
    suppressClick: () => { const suppress = suppressClick.current; suppressClick.current = false; return suppress },
    step: (id: string, direction: 'up' | 'down') => {
      const index = list?.data.findIndex(product => product.id === id) ?? -1
      const target = index >= 0 ? list?.data[index + (direction === 'up' ? -1 : 1)] : undefined
      if (target) void run(id, { target_id: target.id, placement: direction === 'up' ? 'before' : 'after' })
    },
    retry: () => { if (pending) void run(pending.id, pending.move, pending) },
  }
}
