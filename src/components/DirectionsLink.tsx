import { useSyncExternalStore } from 'react'
import { googleDirectionsUrl } from '../utils/directions'
import { Icon } from './ui'
import './directions.css'

const desktop = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(desktop)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const desktopSnapshot = () => window.matchMedia(desktop).matches

export function DirectionsLink({ address }: { address: string | null | undefined }) {
  const newTab = useSyncExternalStore(subscribe, desktopSnapshot, () => false)
  const href = googleDirectionsUrl(address)
  if (!address?.trim()) return null
  if (!href) return <p className="directions-unavailable">Adres yol tarifi bağlantısı için çok uzun.</p>
  return <span className="directions-action">
    <a className="ui-button ui-button--secondary" href={href} target={newTab ? '_blank' : undefined}
      rel="noopener noreferrer" referrerPolicy="no-referrer"
      aria-label={`Yol Tarifi Al (Google Haritalar${newTab ? ', yeni sekme' : ''})`}>
      <Icon name="navigation" />Yol Tarifi Al
    </a>
  </span>
}
