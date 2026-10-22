import { adjustmentLabels } from '../services/adjustments'
import { useCallback, useState, type FormEvent } from 'react'
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { listPayments, type PaymentFilter } from '../services/finance'
import type { PaymentMethod } from '../services/sales'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { methodLabels, saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { customerHref } from '../customers/routing'
import { Pagination } from './Pagination'
import { correctionHref } from '../services/corrections'

export function PaymentHistory({ customerId }: { customerId?: string }) {
  const [page, setPage] = useState(1), [method, setMethod] = useState<PaymentMethod | ''>('')
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [error, setError] = useState('')
  const [dates, setDates] = useState<Pick<PaymentFilter, 'from' | 'to'>>({})
  const load = useCallback(() => listPayments({ page, pageSize: 10, customer_id: customerId, method: method || undefined, ...dates }), [page, customerId, method, dates])
  const { result, retry } = useResource(`${customerId}:${page}:${method}:${JSON.stringify(dates)}`, load)
  function filterDates(event: FormEvent) {
    event.preventDefault()
    if (from && to && from > to) { setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.'); return }
    if ([from, to].some(value => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00+03:00`))))) { setError('Geçerli bir tarih girin.'); return }
    setError(''); setPage(1)
    setDates({ from: from ? new Date(`${from}T00:00:00+03:00`).toISOString() : undefined,
      to: to ? new Date(Date.parse(`${to}T00:00:00+03:00`) + 86400000).toISOString() : undefined })
  }
  return <section aria-label="Tahsilat geçmişi">
    <form className="finance-filters" onSubmit={filterDates}>
      <Select label="Ödeme yöntemi filtresi" value={method} onChange={event => { setMethod(event.target.value as PaymentMethod | ''); setPage(1) }}>
        <option value="">Tümü</option><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option>
      </Select>
      <Input label="Başlangıç tarihi" type="date" min="0001-01-01" max="9999-12-30" value={from} onChange={event => setFrom(event.target.value)} />
      <Input label="Bitiş tarihi" type="date" min="0001-01-01" max="9999-12-30" value={to} onChange={event => setTo(event.target.value)} />
      <Button type="submit" variant="secondary">Tarihleri filtrele</Button>
    </form>
    {customerId && <a className="finance-link" href="#/tahsilatlar">Tüm müşterilerin tahsilatları</a>}
    {error && <p role="alert" className="finance-validation">{error}</p>}
    {!result ? <LoadingState label="Tahsilatlar yükleniyor…" /> : result.error ? <ErrorState title="Tahsilatlar yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Tahsilat bulunamadı" description="İlk ödemeler ve sonradan tahsilatlar burada görüntülenir." />
        : <ul className="finance-history">{result.data.data.map(payment => <li key={payment.id}>
          <div className="finance-history-heading"><a className="finance-link" href={customerHref(payment.customer_id)}>{payment.customer_name}</a>
            <Badge tone={payment.is_valid ? 'success' : 'neutral'}>{payment.adjustment_kind ? (payment.reversal_of_payment_id ? adjustmentLabels[payment.adjustment_kind] : 'Düzeltmeyle kapatılmış tahsilat') : payment.reversal_of_payment_id ? 'Geçmiş ters kayıt' : !payment.is_valid ? 'Ters kayıtla kapatılmış' : payment.is_initial ? 'İlk ödeme' : 'Tahsilat'}</Badge></div>
          <dl><div><dt>Tutar</dt><dd className="money">{formatMoney(payment.amount_kurus)}</dd></div>
            <div><dt>Yöntem</dt><dd>{methodLabels[payment.method]}</dd></div><div><dt>İşlemi yapan</dt><dd>{payment.created_by_username}</dd></div>
            <div><dt>Tarih</dt><dd>{saleDate(payment.created_at)}</dd></div>
            <div><dt>Güncel satış borcu</dt><dd className="money">{payment.sale_remaining_kurus === null ? 'Satışa bağlı değil' : formatMoney(payment.sale_remaining_kurus)}</dd></div></dl>
          {payment.sale_id && <a className="finance-link" href={saleHref(payment.sale_id)}>İlgili satışı görüntüle</a>}
          {payment.is_valid && <a className="finance-link" href={correctionHref('payment', payment.id)}>Tahsilat için düzeltme talebi</a>}
        </li>)}</ul>}
      <Pagination page={result.data.pagination} label="Tahsilat sayfaları" onPage={setPage} />
    </>}
  </section>
}
