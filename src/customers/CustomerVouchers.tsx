import { useCallback, useState } from 'react'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { getVouchers, voucherLabels } from '../services/vouchers'
import { saleHref } from '../sales/routing'
import { saleDate } from '../sales/presentation'
export function CustomerVouchers({ id }: { id: string }) {
 const [page, setPage] = useState(1), load = useCallback(() => getVouchers(id, page), [id, page])
 const { result, retry } = useResource(id + ':' + page, load)
 return <Card title="Su Fişi Hareketleri" accessory={<Button variant="ghost" onClick={retry}>Yenile</Button>}>
  {!result ? <LoadingState label="Su fişleri yükleniyor…" /> : result.error ? <ErrorState title="Su fişi bilgileri alınamadı" description={result.error} onRetry={retry} /> : result.data && <>
   <p><strong>Kullanılabilir Su Fişi: {result.data.available_quantity} adet</strong></p>
   {!result.data.data.length ? <EmptyState title="Su fişi hareketi yok" description="Fiş satışları ve teslimatlar burada görünür." /> : <div className="operation-table-scroll" role="region" aria-label="Su fişi hareketleri" tabIndex={0}><table className="operation-table">
    <thead><tr><th>Tarih</th><th>İşlem</th><th>Adet</th><th>Kalan</th><th>İşlemi yapan</th><th>Satış</th></tr></thead>
    <tbody>{result.data.data.map(row => <tr key={row.id}><td>{saleDate(row.created_at)}</td><td>{voucherLabels[row.movement_type]}</td><td className="money">{row.quantity > 0 ? '+' : ''}{row.quantity}</td><td className="money">{row.balance_after}</td><td>{row.created_by_username}</td><td><a className="text-link" href={saleHref(row.sale_id)}>Satış detayı</a></td></tr>)}</tbody>
   </table></div>}
   {result.data.pagination.totalPages > 1 && <nav className="sale-pagination" aria-label="Fiş hareket sayfaları"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Önceki</Button><span>{page} / {result.data.pagination.totalPages}</span><Button variant="secondary" disabled={page >= result.data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Sonraki</Button></nav>}
  </>}
 </Card>
}
