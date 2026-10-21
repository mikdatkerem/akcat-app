import { apiUrl } from '../config/api'

export async function checkApiHealth(): Promise<void> {
  const response = await fetch(apiUrl('/api/health'), {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Sağlık kontrolü başarısız (HTTP ${response.status}).`)
  }

  const result: unknown = await response.json()

  if (
    typeof result !== 'object' || result === null ||
    !('status' in result) || result.status !== 'ok' ||
    !('database' in result) || result.database !== 'connected'
  ) {
    throw new Error('API beklenen sağlık yanıtını döndürmedi.')
  }
}
