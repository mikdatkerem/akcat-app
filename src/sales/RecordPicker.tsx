import { useCallback, useState, type ReactNode } from 'react'
import { Button, EmptyState, ErrorState, Input, LoadingState } from '../components/ui'
import { useResource } from '../hooks/useResource'

type Results<T> = { data: T[]; pagination: { page: number; totalPages: number } }
export function RecordPicker<T extends { id: string; name: string }>({ label, load, onSelect, describe, disabled = false, excluded = [] }: {
  label: string; load: (q: string, page: number) => Promise<Results<T>>; onSelect: (value: T) => void;
  describe: (value: T) => ReactNode; disabled?: boolean; excluded?: string[]
}) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const fetch = useCallback(() => load(query, page), [load, query, page])
  const { result, retry } = useResource(`${query}:${page}`, fetch)
  function search() {
    if (disabled) return
    if (query === text.trim() && page === 1) retry()
    setQuery(text.trim()); setPage(1)
  }
  return <div className="sale-picker">
    <div className="sale-picker-search" role="search" aria-label={label}>
      <Input label={label} type="search" value={text} maxLength={100} disabled={disabled} onChange={event => setText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search() } }} />
      <Button variant="secondary" disabled={disabled} onClick={search}>Ara</Button>
    </div>
    {!result ? <LoadingState label="Seçenekler yükleniyor…" /> : result.error ? <ErrorState title="Seçenekler yüklenemedi" description={result.error} onRetry={retry} />
      : result.data && <>
        {result.data.data.length === 0 ? <EmptyState title="Kayıt bulunamadı" description="Aramayı değiştirin veya ilgili kaydı ekleyin." />
          : <ul className="sale-options">{result.data.data.map(value => <li key={value.id}>
            <div><strong>{value.name}</strong><small>{describe(value)}</small></div>
            <Button variant="secondary" disabled={disabled || excluded.includes(value.id)} onClick={() => onSelect(value)} aria-label={`${value.name} seç`}>{excluded.includes(value.id) ? 'Eklendi' : 'Seç'}</Button>
          </li>)}</ul>}
        {result.data.pagination.totalPages > 1 && <div className="sale-picker-pages" aria-label={`${label} sayfaları`}>
          <Button variant="ghost" disabled={disabled || page <= 1} onClick={() => setPage(value => value - 1)}>Önceki sonuçlar</Button>
          <span>{page} / {result.data.pagination.totalPages}</span>
          <Button variant="ghost" disabled={disabled || page >= result.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Sonraki sonuçlar</Button>
        </div>}
      </>}
  </div>
}
