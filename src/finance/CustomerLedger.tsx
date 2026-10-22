import { useCallback, useState } from 'react'
import { Card, EmptyState, ErrorState, LoadingState, Select } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { customerLedger, type LedgerFilter } from '../services/finance'
import { formatMoney } from '../utils/format'
import { methodLabels, saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { Pagination } from './Pagination'

export function CustomerLedger({ id }: { id: string }) {
  const [page, setPage] = useState(1), [type, setType] = useState<LedgerFilter['type']>('all')
  const load = useCallback(() => customerLedger(id, { page, pageSize: 10, type }), [id, page, type])
  const { result, retry } = useResource(`${id}:${page}:${type}`, load)
  return <Card title="Tahsilat ve finansal hareket geçmişi">
    <div className="finance-ledger-filter"><Select label="Hareket türü" value={type} onChange={event => { setType(event.target.value as LedgerFilter['type']); setPage(1) }}>
      <option value="all">Tümü</option><option value="sale">Satışlar</option><option value="payment">Tahsilatlar</option><option value="reversal">Geçmiş ters kayıtlar</option><option value="record_reversal">Hatalı tahsilat ters kayıtları</option><option value="external_refund">Harici para iadeleri</option><option value="cancellation">Satış iptalleri</option>
    </Select></div>
    {!result ? <LoadingState label="Hareketler yükleniyor…" /> : result.error ? <ErrorState title="Finansal hareketler yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Finansal hareket bulunamadı" description="Satışlar ve tahsilatlar kaydedildiğinde burada gösterilir." />
        : <ul className="finance-ledger">{result.data.data.map(entry => <li key={entry.id}>
          <div><a className="finance-link" href={saleHref(entry.sale_id)}>{entry.type === 'sale' ? 'Satış' : entry.type === 'payment' ? 'Tahsilat' : entry.type === 'record_reversal' ? 'Hatalı tahsilat ters kaydı' : entry.type === 'external_refund' ? 'Harici para iadesi' : entry.type === 'cancellation' ? 'Satış iptali' : 'Geçmiş ters kayıt'} · {saleDate(entry.created_at)}</a>
            <small>{entry.created_by_username}{entry.method ? ` · ${methodLabels[entry.method]}` : ''}{!entry.effective ? ' · Borca etkisiz kayıt' : ''}</small></div>
          <dl><div><dt>İşlem tutarı</dt><dd className="money">{formatMoney(entry.amount_kurus)}</dd></div>
            <div><dt>İşlem sonrası satış borcu</dt><dd className="money">{formatMoney(entry.sale_balance_after_kurus)}</dd></div>
            <div><dt>İşlem sonrası müşteri borcu</dt><dd className="money">{formatMoney(entry.balance_after_kurus)}</dd></div></dl>
        </li>)}</ul>}
      <Pagination page={result.data.pagination} label="Finansal hareket sayfaları" onPage={setPage} />
    </>}
  </Card>
}
