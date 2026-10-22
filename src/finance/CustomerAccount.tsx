import { useCallback, useState } from 'react'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { customerReceivables } from '../services/finance'
import type { SaleSummary } from '../services/sales'
import { formatMoney } from '../utils/format'
import { saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { Pagination } from './Pagination'
import { paymentHref } from './routing'
import './finance.css'

export function CustomerAccount({ id, onSelect, selectedId, disabled = false }: { id: string; onSelect?: (sale: SaleSummary) => void; selectedId?: string; disabled?: boolean }) {
  const [page, setPage] = useState(1)
  const load = useCallback(() => customerReceivables(id, { page, pageSize: 5 }), [id, page])
  const { result, retry } = useResource(`${id}:${page}`, load)
  if (!result) return <LoadingState label="Açık borç yükleniyor…" />
  if (result.error || !result.data) return <ErrorState title="Borç bilgileri alınamadı" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} />
  const account = result.data
  return <Card title="Açık borç ve satışlar" className="finance-account">
    <dl className="finance-summary"><div><dt>Toplam açık borç</dt><dd className="money finance-debt-total">{formatMoney(account.summary.total_debt_kurus)}</dd></div>
      <div><dt>Açık satış</dt><dd>{account.summary.open_sales_count}</dd></div>
      <div><dt>Son tahsilat</dt><dd>{account.summary.last_payment_at ? saleDate(account.summary.last_payment_at) : 'Henüz tahsilat yok'}</dd></div></dl>
    <div className="finance-actions"><Button variant="ghost" disabled={disabled} onClick={retry}>Borcu yenile</Button>
      {!onSelect && account.summary.total_debt_kurus > 0 && <a className="ui-button ui-button--secondary" href={paymentHref(id)}>Tahsilat al</a>}</div>
    {account.data.length === 0 ? <EmptyState title={account.summary.open_sales_count ? 'Bu sayfada açık satış yok' : 'Açık borç yok'} description="Ödenmemiş satışlar burada gösterilir." />
      : <ul className="finance-open-sales">{account.data.map(sale => <li key={sale.id}>
        <div><a className="finance-link" href={saleHref(sale.id)}>{saleDate(sale.created_at)} · Satış detayı</a><small>Kaydeden: {sale.created_by_username}</small>
          <span>Toplam {formatMoney(sale.total_kurus)} · Ödenen {formatMoney(sale.paid_kurus)}</span>
          <strong className="money">Kalan: {formatMoney(sale.remaining_kurus)}</strong></div>
        {onSelect ? <Button variant="secondary" disabled={disabled || selectedId === sale.id} aria-label={`${sale.id} satışına tahsilat`} onClick={() => onSelect(sale)}>{selectedId === sale.id ? 'Seçildi' : 'Bu satışa tahsilat'}</Button>
          : <a className="ui-button ui-button--secondary" href={paymentHref(id, sale.id)}>Tahsilat al</a>}
      </li>)}</ul>}
    <Pagination page={account.pagination} label="Açık satış sayfaları" onPage={setPage} disabled={disabled} />
  </Card>
}
