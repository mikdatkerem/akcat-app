import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { Button, Icon } from '../components/ui'
import { apiRequest, ApiError } from '../services/apiClient'
import { validCoordinates } from '../utils/directions'
import 'leaflet/dist/leaflet.css'
import './location-picker.css'

export type CustomerLocation = { latitude: number | null; longitude: number | null }
export default function LocationPicker({ initial, address, onClose, onConfirm }: {
  initial: CustomerLocation; address: string; onClose: () => void
  onConfirm: (point: CustomerLocation, address: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), container = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null), marker = useRef<Marker | null>(null)
  const starting = useRef(initial), revision = useRef(0), alive = useRef(true)
  const [point, setPoint] = useState(initial), [text, setText] = useState(address)
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [tileError, setTileError] = useState(false)
  const cache = useRef(new Map<string, string | null>()), lastRequest = useRef(0), resolving = useRef(false)
  const selected = validCoordinates(point.latitude, point.longitude)

  useEffect(() => {
    alive.current = true
    const element = dialog.current!, previous = document.activeElement as HTMLElement | null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element.showModal()
    element.querySelector<HTMLElement>('button')?.focus()
    let disposed = false
    void import('leaflet').then(L => {
      if (disposed || !container.current) return
      const initialPoint = starting.current
      const lat = Number(import.meta.env.VITE_MAP_CENTER_LAT), lng = Number(import.meta.env.VITE_MAP_CENTER_LNG)
      const configured = !!import.meta.env.VITE_MAP_CENTER_LAT && !!import.meta.env.VITE_MAP_CENTER_LNG && validCoordinates(lat, lng)
      const hasPoint = validCoordinates(initialPoint.latitude, initialPoint.longitude)
      const instance = L.map(container.current, { worldCopyJump: true, zoomControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView(hasPoint
        ? [initialPoint.latitude!, initialPoint.longitude!] : configured ? [lat, lng] : [40.76528, 29.94083], hasPoint || configured ? 15 : 11)
      L.control.zoom({ zoomInTitle: 'Yakınlaştır', zoomOutTitle: 'Uzaklaştır' }).addTo(instance)
      map.current = instance
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance)
      tiles.on('tileerror', () => { if (!disposed) setTileError(true) })
      const icon = L.divIcon({ className: 'customer-map-pin', html: '<span aria-hidden="true"></span>', iconSize: [28, 36], iconAnchor: [14, 34] })
      function select(latitude: number, longitude: number) {
        longitude = ((longitude + 180) % 360 + 360) % 360 - 180
        if (!validCoordinates(latitude, longitude)) return
        revision.current++
        setPoint({ latitude, longitude }); setText(''); setError('')
        if (marker.current) marker.current.setLatLng([latitude, longitude])
        else {
          marker.current = L.marker([latitude, longitude], { icon, draggable: true, title: 'Seçilen konum; sürükleyerek değiştirin', alt: 'Seçilen müşteri konumu' }).addTo(instance)
          marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); select(p.lat, p.lng) })
        }
      }
      instance.on('click', event => select(event.latlng.lat, event.latlng.lng))
      // Enter selects the map center after keyboard pan/zoom, without an extra UI action.
      const keyboardSelect = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); const p = instance.getCenter(); select(p.lat, p.lng) } }
      container.current.addEventListener('keydown', keyboardSelect)
      instance.on('unload', () => container.current?.removeEventListener('keydown', keyboardSelect))
      if (hasPoint) {
        select(initialPoint.latitude!, initialPoint.longitude!)
        setText(address)
      }
      setReady(true)
      instance.invalidateSize()
    }).catch(() => { if (!disposed) setError('Harita yüklenemedi. İptal ederek adresi formda elle yazabilirsiniz.') })
    return () => {
      disposed = true; alive.current = false
      map.current?.remove(); map.current = null; marker.current = null
      element.close(); document.documentElement.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [address])

  async function confirmLocation() {
    if (!selected || resolving.current) return
    if (point.latitude === initial.latitude && point.longitude === initial.longitude && text.trim()) { onConfirm(point, text.trim()); return }
    const key = `${point.latitude},${point.longitude}`, current = revision.current
    const cached = cache.current.get(key)
    if (cached) { onConfirm(point, cached); return }
    if (Date.now() - lastRequest.current < 2000) { setError('Yeni sorgu için kısa bir süre bekleyin.'); return }
    resolving.current = true; lastRequest.current = Date.now(); setBusy(true); setError('')
    try {
      const value = await apiRequest('/api/v1/customers/resolve-location', { method: 'POST', body: point }) as { address?: unknown }
      if (value.address !== null && typeof value.address !== 'string') throw new Error('Geçersiz adres yanıtı.')
      const resolved = typeof value.address === 'string' ? value.address : null
      cache.current.set(key, resolved)
      if (alive.current && current === revision.current) {
        setText(resolved ?? '')
        if (resolved?.trim()) onConfirm(point, resolved.trim())
        else setError('Bu nokta için adres bulunamadı. Başka bir nokta seçin veya İptal ile formdaki adresi elle yazın.')
      }
    } catch (cause) {
      if (alive.current && current === revision.current) setError(cause instanceof ApiError && cause.code === 'GEOCODING_UNAVAILABLE'
        ? 'Otomatik adres bulma yapılandırılmamış. İptal ile formdaki adresi elle yazabilirsiniz.'
        : 'Adres servisine ulaşılamadı. Tekrar deneyin veya İptal ile adresi formda elle yazın.')
    } finally { resolving.current = false; if (alive.current) setBusy(false) }
  }
  return <dialog ref={dialog} className="location-dialog" aria-labelledby="location-title" aria-describedby="location-description"
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
      if (event.target !== event.currentTarget) return
      const r = event.currentTarget.getBoundingClientRect()
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose()
    }}>
    <header><div><h2 id="location-title">Konum Seç</h2><p id="location-description">Haritada müşterinin adresini seçin.</p></div>
      <Button variant="ghost" aria-label="Konum seçimini kapat" onClick={onClose}><Icon name="close" /></Button></header>
    <div className="location-dialog__body">
      {!ready && !error && <p role="status">Harita yükleniyor…</p>}
      <div ref={container} className="customer-map" aria-label="Müşteri konum haritası" />
      {tileError && <p role="status">Harita görselleri yüklenemedi. İnternet bağlantısını kontrol edin veya manuel adres girişini kullanın.</p>}
      {selected && <p role="status">Konum seçildi. Adresi aktarmak için Konumu Kullan’a basın.</p>}
      {busy && <p role="status">Seçilen konumun adresi bulunuyor…</p>}
      {error && <p role="alert">{error}</p>}
      <p className="location-help">Adres çözümleme: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>. Otomatik sonuç teslimat adresinin doğruluğunu garanti etmez.</p>
    </div>
    <footer><Button variant="secondary" onClick={onClose}>İptal</Button><Button disabled={!selected || busy} loading={busy} loadingText="Adres bulunuyor…" onClick={() => { void confirmLocation() }}>Konumu Kullan</Button></footer>
  </dialog>
}
