import { useCallback, useState } from 'react'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { getProductPriceHistory } from '../services/products'
import { formatMoney } from '../utils/format'

const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' })
export function PriceHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1)
  const load = useCallback(() => getProductPriceHistory(id, page), [id, page])
  const { result, retry } = useResource(`${id}:${page}`, load)
  return <Card title="Fiyat geçmişi" description="İzlenebilir fiyat kaydı devreye alındıktan sonraki değişiklikler.">
    {!result ? <LoadingState label="Fiyat geçmişi yükleniyor…" /> : result.error || !result.data
      ? <ErrorState title="Fiyat geçmişi alınamadı" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} />
      : <>{result.data.data.length === 0 ? <EmptyState title="Henüz fiyat değişikliği yok" description="Eski fiyatı bilinmeyen geçmiş işlemler burada gösterilmez." />
        : <ul className="product-price-history">{result.data.data.map(row => {
          const difference = BigInt(row.new_price_kurus) - BigInt(row.old_price_kurus)
          return <li key={row.id}><div className="money">{formatMoney(row.old_price_kurus)} → <strong>{formatMoney(row.new_price_kurus)}</strong>
            <span> ({difference > 0n ? '+' : ''}{formatMoney(difference)})</span></div>
            <small>{row.username ?? 'Kullanıcı kaydı yok'} · <time dateTime={row.created_at}>{date.format(new Date(row.created_at))}</time></small></li>
        })}</ul>}
        {result.data.pagination.totalPages > 1 && <div className="product-pagination" aria-label="Fiyat geçmişi sayfaları">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Önceki</Button>
          <span>{page} / {result.data.pagination.totalPages}</span>
          <Button variant="secondary" disabled={page >= result.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Sonraki</Button>
        </div>}
      </>}
  </Card>
}
