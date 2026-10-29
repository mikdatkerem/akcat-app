import { useCallback, useState, useSyncExternalStore } from 'react'
import { sessionStore } from '../auth/sessionStore'
import { Card, EmptyState, ErrorState, HelpDisclosure, LoadingState } from '../components/ui'
import { listAdjustments, adjustmentLabels, type AdjustmentFilter } from '../services/adjustments'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { saleDate, methodLabels } from '../sales/presentation'
import { Pagination } from './Pagination'

export function AdjustmentHistory({ filter }: { filter: Omit<AdjustmentFilter, 'page' | 'pageSize'> }) {
  const viewer = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot).session?.user
  const [page, setPage] = useState(1), key = JSON.stringify(filter)
  const load = useCallback(() => listAdjustments({ ...filter, page, pageSize: 10 }), [filter, page])
  const { result, retry } = useResource(key + ':' + page, load)
  return <Card title="Ters kayıt ve harici iade geçmişi">
    <HelpDisclosure title="Düzeltme geçmişi hakkında">
      <p>İadeler normal tahsilat değildir. Kayıt tarihi adminin uygulama/teyit tarihidir; sistem para transferi yapmaz.</p>
    </HelpDisclosure>
    {!result ? <LoadingState label="Finansal düzeltmeler yükleniyor…" /> : result.error ? <ErrorState title="Düzeltme geçmişi yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Finansal düzeltme bulunamadı" description="Uygulanan tam ters kayıtlar ve teyitli harici iadeler burada gösterilir." />
        : <ul className="finance-history">{result.data.data.map(row => <li key={row.id}>
          <div className="finance-history-heading"><strong>{adjustmentLabels[row.kind]}</strong><span className="money">{formatMoney(row.amount_kurus)}</span></div>
          <dl><div><dt>Asıl tahsilat</dt><dd className="correction-target">{row.payment_id}</dd></div><div><dt>Müşteri / yöntem</dt><dd>{row.customer_name} · {methodLabels[row.method]}</dd></div>
            <div><dt>Gerekçe</dt><dd>{row.reason}</dd></div><div><dt>Talep eden</dt><dd>{row.requested_by_username}</dd></div>
            <div><dt>Uygulayan / onaylayan</dt><dd>{row.performed_by_username} / {row.approved_by_username}</dd></div><div><dt>Kayıt tarihi</dt><dd>{saleDate(row.created_at)}</dd></div>
            <div><dt>Satış borcu (önce → sonra)</dt><dd className="money">{formatMoney(row.before_sale_remaining_kurus)} → {formatMoney(row.after_sale_remaining_kurus)}</dd></div>
            {row.kind === 'external_refund' && <><div><dt>Harici iade teyidi</dt><dd>Admin tarafından teyit edildi · {saleDate(row.external_confirmed_at!)}</dd></div>
              <div><dt>Referans</dt><dd>{row.external_reference}</dd></div></>}
          </dl>{(viewer?.role === 'admin' || viewer?.id === row.requested_by) && <a className="text-link" href={'#/duzeltmeler/' + row.correction_request_id}>Talep ve onay detayı</a>}
        </li>)}</ul>}
      <Pagination page={result.data.pagination} label="Finansal düzeltme sayfaları" onPage={setPage} />
    </>}
  </Card>
}
