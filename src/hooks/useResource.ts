import { useEffect, useState } from 'react'
import { ApiError } from '../services/apiClient'

export function useResource<T>(key: string, load: () => Promise<T>) {
  const [revision, retry] = useState(0)
  const [result, setResult] = useState<{ key: string; revision: number; data?: T; error?: string } | null>(null)
  useEffect(() => {
    let current = true
    load().then(data => { if (current) setResult({ key, revision, data }) }, error => {
      if (current) setResult({ key, revision, error: error instanceof ApiError ? error.message : 'Veriler yüklenemedi. Lütfen tekrar deneyin.' })
    })
    return () => { current = false }
  }, [key, load, revision])
  return { result: result?.key === key && result.revision === revision ? result : null, retry: () => retry(value => value + 1) }
}
