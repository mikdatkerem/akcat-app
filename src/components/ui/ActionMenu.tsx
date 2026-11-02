import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export function ActionMenu({ label, disabled = false, triggerClassName = '', menuClassName = '', triggerContent, triggerProps, children }: {
  label: string; disabled?: boolean; triggerClassName?: string; menuClassName?: string
  triggerContent?: ReactNode
  triggerProps?: Pick<ComponentProps<'button'>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClick' | 'onKeyDown'>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false), id = useId()
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const popup = menu.current!
    const sync = () => setOpen(popup.matches(':popover-open'))
    popup.addEventListener('toggle', sync)
    return () => popup.removeEventListener('toggle', sync)
  }, [])
  function position() {
    const popup = menu.current!, rect = trigger.current!.getBoundingClientRect(), box = popup.getBoundingClientRect(), inset = 8
    // Individual CSSOM properties preserve the existing style-src-attr 'none' CSP.
    popup.style.left = `${Math.max(inset, Math.min(rect.right - box.width, window.innerWidth - box.width - inset))}px`
    const below = rect.bottom + 4, above = rect.top - box.height - 4
    popup.style.top = `${Math.max(inset, Math.min(below + box.height <= window.innerHeight - inset ? below : above, window.innerHeight - box.height - inset))}px`
  }
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open])
  function close(restoreFocus = true) { menu.current?.hidePopover(); if (restoreFocus) trigger.current?.focus({ preventScroll: true }) }
  function show(last = false) {
    menu.current!.showPopover(); position()
    const items = menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')
    items[last ? items.length - 1 : 0]?.focus()
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    else if (event.key === 'Tab') close()
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }
  return <div className="ui-action-menu" onClick={event => event.stopPropagation()}>
    <Button {...triggerProps} ref={trigger} id={`${id}-trigger`} variant="ghost" className={`ui-action-menu__trigger ${triggerClassName}`}
      aria-label={label} aria-haspopup="menu" aria-controls={id} aria-expanded={open} disabled={disabled}
      onClick={event => { triggerProps?.onClick?.(event); if (!event.defaultPrevented) { if (menu.current?.matches(':popover-open')) close(); else show() } }}
      onKeyDown={event => { triggerProps?.onKeyDown?.(event); if (!event.defaultPrevented && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); show(event.key === 'ArrowUp') } }}>{triggerContent ?? <Icon name="more" />}</Button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-labelledby={`${id}-trigger`} className={`ui-action-menu__popup ${menuClassName}`} onKeyDown={navigate}
      onClickCapture={event => {
        const action = (event.target as Element).closest<HTMLElement>('[role="menuitem"]')
        if (action && !action.matches(':disabled')) close(action.tagName !== 'A')
      }}>
      {children}
    </div>
  </div>
}
