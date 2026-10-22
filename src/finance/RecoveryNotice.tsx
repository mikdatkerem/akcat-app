import { useState } from 'react'
import { Button, Card } from '../components/ui'

export function RecoveryNotice({ history, discard, disabled = false }: { history: string; discard: () => boolean; disabled?: boolean }) {
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState('')
  return <Card title="Önceki işlemin sonucunu kontrol edin">
    <p>Önceki satış veya tahsilatın yanıtı doğrulanamamış olabilir. Aynı bilgileri yeniden gönderirseniz önceki işlem anahtarı kullanılır; farklı bilgilerle tekrar gönderim reddedilir.</p>
    <p><a className="text-link" href={history}>Önce işlem geçmişini inceleyin</a>. Ayrı bir yeni işlem başlatmadan önce önceki kaydın sonucunu doğrulayın.</p>
    <label className="refund-confirmation"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => setConfirmed(event.target.checked)} />Önceki işlemi geçmişten kontrol ettim.</label>
    <Button variant="secondary" disabled={disabled || !confirmed} onClick={() => { if (discard()) window.location.hash = history; else setError('Tarayıcı işlem bilgisini temizleyemedi. Yeni işlem başlatılmadı.') }}>Ayrı yeni işlem başlat</Button>
    {error && <p role="alert">{error}</p>}
  </Card>
}
