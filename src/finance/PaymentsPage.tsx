import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ErrorState, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getCustomer } from '../services/customers'
import { getSale } from '../services/sales'
import type { Payment } from '../services/finance'
import { useResource } from '../hooks/useResource'
import { formatMoney } from '../utils/format'
import { methodLabels } from '../sales/presentation'
import { CollectionForm } from './CollectionForm'
import type { Collection } from '../services/collections'
import { PaymentForm } from './PaymentForm'
import { CustomerAccount } from './CustomerAccount'
import { PaymentHistory } from './PaymentHistory'
import { PaymentDialog } from './PaymentDialog'
import { useFinanceLocation } from './routing'
import './finance.css'

function PaymentRoute({ actor, customerId, saleId, onSaved, onBusyChange, onDismiss }: { actor: string; customerId?: string; saleId?: string; onSaved: (value: Payment | Collection) => void; onBusyChange: (busy: boolean) => void; onDismiss: () => void }) {
  const load = useCallback(async () => {
    const sale = saleId ? await getSale(saleId) : undefined
    if (sale && !sale.customer_id) throw new Error('Hızlı satışlara sonradan tahsilat yapılamaz. İade/düzeltme için satış detayını kullanın.')
    if (sale && customerId && sale.customer_id !== customerId) throw new Error('Müşteri ve satış eşleşmiyor.')
    const customer = customerId || sale ? await getCustomer(customerId ?? sale!.customer_id!) : undefined
    return { customer, sale }
  }, [customerId, saleId])
  const { result, retry } = useResource(`${customerId}:${saleId}`, load)
  if (!result) return <><PageHeader title="Yeni tahsilat" description="Müşteri ve satış bilgileri yükleniyor." /><LoadingState label="Lütfen bekleyin…" /></>
  if (result.error || !result.data) return <><PageHeader title="Yeni tahsilat" description="Tahsilat bilgileri alınamadı." /><ErrorState title="Tahsilat başlatılamadı" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} /></>
  if (!result.data.sale) return <CollectionForm embedded onDismiss={onDismiss} onBusyChange={onBusyChange} actor={actor} initialCustomer={result.data.customer} onSaved={onSaved} />
  return <PaymentForm embedded onDismiss={onDismiss} onBusyChange={onBusyChange} actor={actor} initialCustomer={result.data.customer} initialSale={result.data.sale} onSaved={onSaved} />
}
export function PaymentsPage({ userId }: { userId: string }) {
  const hash = useFinanceLocation(), [receipt, setReceipt] = useState<Payment | Collection | null>(null)
  const [opened, setOpened] = useState(false), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const route = useMemo(() => { const [path, query] = hash.split('?'); const params = new URLSearchParams(query); return {
    create: path.replace(/\/$/, '') === '#/tahsilatlar/yeni', customerId: params.get('customer_id') || undefined, saleId: params.get('sale_id') || undefined,
  } }, [hash])
  useEffect(() => { if (route.create) return; document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [hash, route.create])
  if ([route.customerId, route.saleId].some(value => value && !/^[a-f0-9-]{36}$/i.test(value))) return <ErrorState title="Geçersiz tahsilat adresi" description="Müşteri ve satış adresini kontrol edin." />
  function close() {
    setOpened(false); setBusy(false)
    if (route.create) window.location.hash = '#/tahsilatlar' + (route.customerId ? '?customer_id=' + encodeURIComponent(route.customerId) : '')
  }
  return <>
    <PageHeader title="Tahsilatlar" description="İlk ödemeler ve tüm çalışanların kaydettiği sonradan tahsilatlar." actions={<Button onClick={() => setOpened(true)}>Yeni tahsilat</Button>} />
    {receipt && receipt.customer_id && (!route.customerId || receipt.customer_id === route.customerId) && <div className="finance-success-area" key={receipt.id}>
      <p className="finance-success" role="status">Tahsilat kaydedildi: {formatMoney(receipt.amount_kurus)} · {methodLabels[receipt.method]}</p>
      <CustomerAccount id={receipt.customer_id} />
    </div>}
    {(opened || route.create) && <PaymentDialog busy={busy} close={close}><PaymentRoute onDismiss={close} actor={userId} customerId={route.customerId} saleId={route.saleId} onBusyChange={setBusy} onSaved={value => {
      setReceipt(value); setRevision(v => v + 1); close()
    }} /></PaymentDialog>}
    <PaymentHistory key={route.customerId ?? 'all'} revision={revision} customerId={route.customerId} />
  </>
}
