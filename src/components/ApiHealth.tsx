import { useState } from 'react'
import { checkApiHealth } from '../services/health'
import { Badge, Button, Card, ErrorState, Icon, LoadingState } from './ui'

export function ApiHealth() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleHealthCheck() {
    if (status === 'loading') return
    setStatus('loading')
    try {
      await checkApiHealth()
      setStatus('success')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Bağlantı kurulamadı. Lütfen tekrar deneyin.')
      setStatus('error')
    }
  }

  return (
    <Card title="Bağlantı durumu" description="Hizmet erişimini kontrol edin." className="health-card">
      {status === 'loading' && <LoadingState label="Bağlantı kontrol ediliyor…" />}
      {status === 'error' && <div className="health-card__body"><ErrorState title="Bağlantı doğrulanamadı" description={errorMessage} onRetry={handleHealthCheck} /></div>}
      {status !== 'loading' && status !== 'error' && (
        <div className="health-card__body">
          <Badge tone={status === 'success' ? 'success' : 'neutral'}>{status === 'success' ? 'Bağlantı başarılı' : 'Kontrol edilmedi'}</Badge>
          <p role="status">{status === 'success' ? 'API ve veritabanı bağlantısı doğrulandı.' : 'Bağlantı durumu henüz kontrol edilmedi.'}</p>
        </div>
      )}
      {status !== 'error' && <Button variant="secondary" loading={status === 'loading'} loadingText="Kontrol ediliyor…" onClick={handleHealthCheck}>
        <Icon name="refresh" />Bağlantıyı kontrol et
      </Button>}
    </Card>
  )
}
