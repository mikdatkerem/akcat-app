import { rememberKey } from './pendingKey'
import { RecoveryNotice } from './RecoveryNotice'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listCustomers, type Customer } from '../services/customers'
import type { SaleSummary, PaymentMethod } from '../services/sales'
import { createPayment, type Payment, type PaymentInput } from '../services/finance'
import { ApiError } from '../services/apiClient'
import { formatMoney, parsePriceToKurus } from '../utils/format'
import { RecordPicker } from '../sales/RecordPicker'
import { saleDate } from '../sales/presentation'
import { CustomerAccount } from './CustomerAccount'
import { paymentDraft, updatePaymentDraft, clearPaymentDraft, discardPaymentDraft } from './draft'
const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'all' })

export function PaymentForm({ actor, initialCustomer, initialSale, onSaved }: { actor: string; initialCustomer?: Customer; initialSale?: SaleSummary; onSaved: (payment: Payment) => void }) {
  const [draft] = useState(() => paymentDraft(actor, initialCustomer, initialSale))
  const [customer, setCustomer] = useState(draft.customer), [sale, setSale] = useState(draft.sale)
  const [amount, setAmount] = useState(draft.amount), [method, setMethod] = useState(draft.method)
  const [pending, setPending] = useState(draft.pending), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [errorTitle, setErrorTitle] = useState('Tahsilat kaydı doğrulanamadı')
  const [invalid, setInvalid] = useState<{ customer?: string; sale?: string; amount?: string; method?: string }>({})
  const mounted = useRef(false), sending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { updatePaymentDraft(actor, draft.key, { customer, sale, amount, method, pending }) }, [actor, draft.key, customer, sale, amount, method, pending])
  const locked = busy || !!pending
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    let body: PaymentInput | null = pending
    if (!body) {
      const errors: typeof invalid = {}
      let kurus: number | undefined
      try { kurus = parsePriceToKurus(amount) } catch { errors.amount = 'Geçerli bir tutar girin; en fazla iki ondalık basamak kullanın.' }
      if (!customer) errors.customer = 'Bir müşteri seçin.'
      if (!sale) errors.sale = 'Tahsilat yapılacak açık satışı seçin.'
      if (kurus === 0) errors.amount = 'Tahsilat tutarı sıfırdan büyük olmalı.'
      if (sale && kurus !== undefined && kurus > sale.remaining_kurus) errors.amount = 'Tahsilat seçili satışın kalan borcunu aşamaz.'
      if (!method) errors.method = 'Ödeme yöntemini seçin.'
      setInvalid(errors)
      if (Object.keys(errors).length || !customer || !sale || !method || kurus === undefined) {
        const form = event.currentTarget
        requestAnimationFrame(() => { if (mounted.current) form.querySelector<HTMLElement>('[data-payment-validation], [aria-invalid="true"]')?.focus() })
        return
      }
      body = { customer_id: customer.id, sale_id: sale.id, amount_kurus: kurus, method }
    }
    try { rememberKey(actor, 'payment', draft.key) } catch { setErrorTitle('Tahsilat gönderilmedi'); setError('Tarayıcı işlem anahtarını koruyamadı. Kayıt gönderilmedi; önceki işlemi geçmişten kontrol edin ve tarayıcı ayarlarınızı inceleyin.'); return }
    updatePaymentDraft(actor, draft.key, { pending: body })
    sending.current = true; setPending(body); setBusy(true); setError('')
    try {
      const receipt = await createPayment(body, draft.key)
      if (mounted.current) { clearPaymentDraft(actor); onSaved(receipt) }
    } catch (cause) {
      if (mounted.current) {
        const rejected = cause instanceof ApiError && [400, 403, 413, 415, 422].includes(cause.status)
        setErrorTitle(rejected ? 'Tahsilat kaydedilmedi' : cause instanceof ApiError && cause.status === 409 ? 'Önceki tahsilat bilgilerini kontrol edin' : 'Tahsilat kaydı doğrulanamadı')
        setError(cause instanceof ApiError ? cause.message : 'Tahsilat sonucu doğrulanamadı. Aynı tahsilatı tekrar deneyin.')
        if (rejected) { updatePaymentDraft(actor, draft.key, { pending: null }); setPending(null) }
      }
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <>
    <PageHeader title="Yeni tahsilat" description="Alınan ödemeyi seçtiğiniz satışın borcuna işleyin." actions={<a className="ui-button ui-button--secondary" href="#/tahsilatlar">Tahsilat geçmişi</a>} />
    {draft.recovered && <RecoveryNotice history="#/tahsilatlar" disabled={busy} discard={() => discardPaymentDraft(actor)} />}
    <form className="finance-form" onSubmit={save} noValidate aria-busy={busy}>
      <Card title="Müşteri">
        {customer ? <div className="finance-selected"><strong>{customer.name}</strong><Button variant="ghost" disabled={locked} onClick={() => { setCustomer(null); setSale(null) }}>Müşteriyi değiştir</Button></div>
          : <RecordPicker label="Tahsilat için müşteri ara" load={customers} disabled={locked} describe={value => value.phone || value.address}
            onSelect={value => { setCustomer(value); setSale(null); setInvalid(current => ({ ...current, customer: undefined })) }} />}
        {invalid.customer && <p className="finance-validation" role="alert" tabIndex={-1} data-payment-validation>{invalid.customer}</p>}
      </Card>
      {customer && <CustomerAccount key={customer.id} id={customer.id} onSelect={value => { setSale(value); setInvalid(current => ({ ...current, sale: undefined })) }} selectedId={sale?.id} disabled={locked} />}
      {invalid.sale && <p className="finance-validation" role="alert" tabIndex={-1} data-payment-validation>{invalid.sale}</p>}
      <Card title="Tahsilat bilgileri">
        {sale && <div className="finance-payment-target"><strong>Seçili satış · {saleDate(sale.created_at)}</strong><p>Kaydeden: {sale.created_by_username}</p>
          <p>Satış no: <span className="finance-id">{sale.id}</span></p><p className="money">Kalan satış borcu: {formatMoney(sale.remaining_kurus)}</p></div>}
        <div className="finance-fields"><Input label="Alınan tutar (₺)" name="amount" type="text" inputMode="decimal" maxLength={32} required disabled={locked} value={amount} error={invalid.amount}
          hint="Sıfırdan büyük ve seçili borcu aşmayan tutar girin." onChange={event => { setAmount(event.target.value); setInvalid(current => ({ ...current, amount: undefined })) }} />
          <Select label="Tahsilat yöntemi" name="method" value={method} required disabled={locked} error={invalid.method}
            onChange={event => { setMethod(event.target.value as PaymentMethod | ''); setInvalid(current => ({ ...current, method: undefined })) }}>
            <option value="">Seçin</option><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option>
          </Select></div>
      </Card>
      {error && <ErrorState title={errorTitle} description={error} />}
      {pending && !busy && <p className="finance-info" role="status">Sonuç belirsiz olabilir. Bilgiler ve işlem anahtarı korundu. Sayfayı yenilemeden aynı tahsilatı tekrar deneyin veya geçmişi kontrol edin.</p>}
      <div><Button type="submit" loading={busy} loadingText="Tahsilat kaydediliyor…">{pending ? 'Aynı tahsilatı tekrar dene' : 'Tahsilatı Kaydet'}</Button></div>
    </form>
  </>
}
