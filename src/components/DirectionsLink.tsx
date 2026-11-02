import { googleDirectionsUrl, validCoordinates } from '../utils/directions'
import { Icon } from './ui'
import './directions.css'

export function DirectionsLink({ address, latitude, longitude }: { address: string | null | undefined; latitude?: number | null; longitude?: number | null }) {
  const href = googleDirectionsUrl(address, latitude, longitude)
  if (!address?.trim() && !validCoordinates(latitude, longitude)) return null
  if (!href) return <p className="directions-unavailable">Adres yol tarifi bağlantısı için çok uzun.</p>
  return <span className="directions-action">
    <a className="ui-button ui-button--secondary" href={href} target="_blank"
      rel="noopener noreferrer" referrerPolicy="no-referrer"
      aria-label="Yol Tarifi Al (Google Haritalar, yeni sekme)">
      <Icon name="navigation" />Yol Tarifi Al
    </a>
  </span>
}
