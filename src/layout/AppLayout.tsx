import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Icon } from '../components/ui'
import { NavigationLinks } from './NavigationLinks'
import { AccountActions } from './AccountActions'
import type { User } from '../services/auth'
import type { PageId } from './navigation'
import './layout.css'

export function AppLayout({ page, title, children, user, signingOut, onSignOut }: {
  page: PageId | 'not-found'
  title: string
  children: ReactNode
  user: User
  signingOut: boolean
  onSignOut: () => void
}) {
  const mainRef = useRef<HTMLElement>(null)
  const previousPage = useRef(page)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeDestination = useRef<'trigger' | 'navigation' | 'resize'>('trigger')
  const backdropPress = useRef(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useLayoutEffect(() => {
    if (!drawerOpen || !drawerRef.current) return
    const drawer = drawerRef.current
    const trigger = triggerRef.current
    const main = mainRef.current
    const header = trigger?.closest<HTMLElement>('.mobile-header')
    const headerTop = header?.getBoundingClientRect().top ?? 0
    const savedHeaderTransform = header?.style.transform ?? ''
    const desktop = window.matchMedia('(min-width: 1024px)')
    const body = document.body
    const html = document.documentElement
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - html.clientWidth
    const savedBody = { position: body.style.position, top: body.style.top,
      left: body.style.left, width: body.style.width, overflow: body.style.overflow }
    const savedOverflow = html.style.overflow

    // Sabit body iOS'ta arka plan kaymasını önler; genişlik scrollbar payını korur.
    Object.assign(body.style, { position: 'fixed', top: '-' + scrollY + 'px',
      left: '-' + scrollX + 'px', width: 'calc(100% - ' + scrollbarWidth + 'px)', overflow: 'hidden' })
    html.style.overflow = 'hidden'
    // Sabit body içinde sticky header'ın kaydırma miktarı kadar sıçramasını önle.
    if (header) header.style.transform = 'translateY(' + (headerTop - header.getBoundingClientRect().top) + 'px)'
    drawer.showModal()
    closeButtonRef.current?.focus({ preventScroll: true })

    const handleDesktop = () => {
      if (desktop.matches) {
        closeDestination.current = 'resize'
        setDrawerOpen(false)
      }
    }
    const handleNavigation = () => {
      closeDestination.current = 'navigation'
      setDrawerOpen(false)
    }
    desktop.addEventListener('change', handleDesktop)
    window.addEventListener('hashchange', handleNavigation)
    return () => {
      desktop.removeEventListener('change', handleDesktop)
      window.removeEventListener('hashchange', handleNavigation)
      drawer.close()
      Object.assign(body.style, savedBody)
      html.style.overflow = savedOverflow
      if (header) header.style.transform = savedHeaderTransform
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
      const destination = closeDestination.current
      closeDestination.current = 'trigger'
      if (destination === 'trigger' && trigger?.isConnected) trigger.focus({ preventScroll: true })
      else {
        if (main?.isConnected) main.focus({ preventScroll: true })
        if (destination === 'navigation') window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
  }, [drawerOpen])

  useEffect(() => {
    document.title = title + ' · AKÇAT'
    if (previousPage.current !== page) {
      if (!drawerRef.current?.open) {
        mainRef.current?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
      previousPage.current = page
    }
  }, [page, title])

  function navigateFromDrawer() {
    closeDestination.current = 'navigation'
    setDrawerOpen(false)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={event => {
        event.preventDefault()
        mainRef.current?.focus()
      }}>İçeriğe geç</a>
      <aside className="desktop-sidebar" aria-label="Uygulama kenar çubuğu">
        <a href="#/genel-bakis" className="sidebar-brand" aria-label="AKÇAT ana sayfa">
          <Icon name="droplet" width="26" height="26" /><span>AKÇAT</span>
        </a>
        <div className="sidebar-caption">ÇALIŞMA ALANI</div>
        <NavigationLinks page={page} label="Ana navigasyon" role={user.role} />
        <div className="sidebar-footer"><AccountActions user={user} busy={signingOut} onSignOut={onSignOut} /></div>
      </aside>

      <div className="app-body">
        <header className="mobile-header">
          <Button ref={triggerRef} variant="ghost" className="menu-toggle" aria-label="Menüyü aç"
            aria-controls="mobile-drawer" aria-expanded={drawerOpen} aria-haspopup="dialog"
            onClick={() => {
              if (!window.matchMedia('(min-width: 1024px)').matches) setDrawerOpen(true)
            }}>
            <Icon name="menu" />
          </Button>
          <a href="#/genel-bakis" className="mobile-brand" aria-label="AKÇAT ana sayfa">
            <Icon name="droplet" />AKÇAT
          </a>
        </header>
        <main ref={mainRef} id="main-content" className="app-content" tabIndex={-1} aria-labelledby="page-title">
          {children}
          <footer className="page-footer">AKÇAT<span>Su dağıtım ve operasyon yönetimi</span></footer>
        </main>
      </div>

      <dialog ref={drawerRef} id="mobile-drawer" className="mobile-drawer" aria-label="Ana menü" aria-modal="true"
        onCancel={event => { event.preventDefault(); setDrawerOpen(false) }}
        onClose={() => setDrawerOpen(false)}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        onPointerDown={event => {
          const box = event.currentTarget.getBoundingClientRect()
          backdropPress.current = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
        }}
        onClick={event => {
          const box = event.currentTarget.getBoundingClientRect()
          const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
          if (backdropPress.current && outside) setDrawerOpen(false)
          backdropPress.current = false
        }}>
        <div className="drawer-header">
          <span className="drawer-brand"><Icon name="droplet" width="26" height="26" />AKÇAT</span>
          <Button ref={closeButtonRef} variant="ghost" className="menu-toggle" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="sidebar-caption">ÇALIŞMA ALANI</div>
        <NavigationLinks page={page} label="Mobil navigasyon" role={user.role} onNavigate={navigateFromDrawer} />
        <div className="sidebar-footer"><AccountActions user={user} busy={signingOut} onSignOut={() => {
          setDrawerOpen(false)
          onSignOut()
        }} /></div>
      </dialog>
    </div>
  )
}
