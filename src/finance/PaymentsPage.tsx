import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, ErrorState, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getCustomer } from '../services/customers'
import { getSale } from '../services/sales'
import type { Payment } from '../services/finance'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { methodLabels } from '../sales/presentation'
import { PaymentForm } from './PaymentForm'
import { CustomerAccount } from './CustomerAccount'
import { PaymentHistory } from './PaymentHistory'
import { paymentHref, useFinanceLocation } from './routing'
import './finance.css'

function PaymentRoute({ actor, customerId, saleId, onSaved }: { actor: string; customerId?: string; saleId?: string; onSaved: (value: Payment) => void }) {
  const load = useCallback(async () => {
    const sale = saleId ? await getSale(saleId) : undefined
    if (sale && customerId && sale.customer_id !== customerId) throw new Error('Müşteri ve satış eşleşmiyor.')
    const customer = customerId || sale ? await getCustomer(customerId ?? sale!.customer_id) : undefined
    return { customer, sale }
  }, [customerId, saleId])
  const { result, retry } = useResource(`${customerId}:${saleId}`, load)
  if (!result) return <><PageHeader title="Yeni tahsilat" description="Müşteri ve satış bilgileri yükleniyor." /><LoadingState label="Lütfen bekleyin…" /></>
  if (result.error || !result.data) return <><PageHeader title="Yeni tahsilat" description="Tahsilat bilgileri alınamadı." /><ErrorState title="Tahsilat başlatılamadı" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} /></>
  return <PaymentForm actor={actor} initialCustomer={result.data.customer} initialSale={result.data.sale} onSaved={onSaved} />
}
export function PaymentsPage({ userId }: { userId: string }) {
  const hash = useFinanceLocation(), [receipt, setReceipt] = useState<Payment | null>(null)
  const route = useMemo(() => { const [path, query] = hash.split('?'); const params = new URLSearchParams(query); return {
    create: path.replace(/\/$/, '') === '#/tahsilatlar/yeni', customerId: params.get('customer_id') || undefined, saleId: params.get('sale_id') || undefined,
  } }, [hash])
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [hash])
  if ([route.customerId, route.saleId].some(value => value && !/^[a-f0-9-]{36}$/i.test(value))) return <ErrorState title="Geçersiz tahsilat adresi" description="Müşteri ve satış adresini kontrol edin." />
  if (route.create) return <PaymentRoute key={hash + userId} actor={userId} customerId={route.customerId} saleId={route.saleId} onSaved={value => {
    setReceipt(value); window.location.hash = '#/tahsilatlar?customer_id=' + encodeURIComponent(value.customer_id)
  }} />
  return <>
    <PageHeader title="Tahsilatlar" description="İlk ödemeler ve tüm çalışanların kaydettiği sonradan tahsilatlar." actions={<a className="ui-button ui-button--primary" href={paymentHref(route.customerId)}>Yeni tahsilat</a>} />
    {receipt && receipt.customer_id === route.customerId && <div className="finance-success-area" key={receipt.id}>
      <p className="finance-success" role="status">Tahsilat kaydedildi: {formatMoney(receipt.amount_kurus)} · {methodLabels[receipt.method]}</p>
      <CustomerAccount id={receipt.customer_id} />
    </div>}
    <Card title={route.customerId ? 'Müşterinin tahsilat geçmişi' : 'Tahsilat geçmişi'}><PaymentHistory key={hash} customerId={route.customerId} /></Card>
  </>
}
