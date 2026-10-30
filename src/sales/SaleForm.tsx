import { rememberKey } from '../finance/pendingKey'
import { RecoveryNotice } from '../finance/RecoveryNotice'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Badge, Button, Card, ErrorState, Icon, Input, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listCustomers } from '../services/customers'
import { listProducts } from '../services/products'
import { createSale, type PaymentMethod, type Sale, type SaleInput } from '../services/sales'
import { ApiError } from '../services/apiClient'
import { formatMoney, parsePriceToKurus, priceInputFromKurus } from '../utils/format'
import { RecordPicker } from './RecordPicker'
import { lineTotal, quantityValue, sumLines, unitPriceValue } from './math'
import { clearSaleDraft, discardSaleDraft, saleDraft, updateSaleDraft } from './draft'

const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'active' })
const products = (q: string, page: number) => listProducts({ q, page, pageSize: 5, status: 'active' })
export function SaleForm({ actor, onSaved }: { actor: string; onSaved: (sale: Sale) => void }) {
  const [draft] = useState(() => saleDraft(actor))
  const [customer, setCustomer] = useState(draft.customer)
  const [lines, setLines] = useState(() => draft.lines.map(line => ({ ...line,
    unitPrice: line.unitPrice ?? priceInputFromKurus(line.product.current_price_kurus) })))
  const [payment, setPayment] = useState(draft.payment)
  const [method, setMethod] = useState(draft.method)
  const [changedPrices, setChangedPrices] = useState<{ product_id: string; name: string; expected_list_price_kurus: number; current_price_kurus: number }[]>([])
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<{ customer?: string; items?: string; payment?: string; method?: string }>({})
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<SaleInput | null>(draft.pending)
  const sending = useRef(false), mounted = useRef(false), key = useRef(draft.key)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { updateSaleDraft(actor, draft.key, { customer, lines, payment, method, pending }) }, [actor, draft.key, customer, lines, payment, method, pending])
  let total: number | undefined, paid: number | undefined, calculationError = ''
  try { total = sumLines(lines.map(line => ({ price: unitPriceValue(line.unitPrice), quantity: line.quantity }))) }
  catch (cause) { calculationError = cause instanceof Error ? cause.message : 'Miktarları ve birim fiyatları kontrol edin.' }
  try { paid = parsePriceToKurus(payment) } catch { /* Shown as validation on submit. */ }
  const locked = busy || !!pending
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    let body = pending
    if (!body) {
      const errors: typeof invalid = {}
      if (!customer) errors.customer = 'Bir müşteri seçin.'
      if (!lines.length) errors.items = 'En az bir ürün ekleyin.'
      else if (calculationError || total === undefined) errors.items = calculationError || 'Ürün miktarlarını ve birim fiyatları kontrol edin.'
      if (paid === undefined) errors.payment = 'Geçerli bir ödeme tutarı girin; en fazla iki ondalık basamak kullanın.'
      else if (total !== undefined && paid > total) errors.payment = 'Alınan ödeme satış toplamını aşamaz.'
      if (paid !== undefined && paid > 0 && !method) errors.method = 'Ödeme yöntemini seçin.'
      setInvalid(errors)
      if (Object.keys(errors).length || !customer || total === undefined || paid === undefined) {
        const form = event.currentTarget
        requestAnimationFrame(() => { if (mounted.current) form.querySelector<HTMLElement>('[data-sale-validation], [aria-invalid="true"]')?.focus() })
        return
      }
      body = { customer_id: customer.id, items: lines.map(line => {
        const price = unitPriceValue(line.unitPrice)
        return { product_id: line.product.id, quantity: quantityValue(line.quantity),
          ...(price !== line.product.current_price_kurus ? { unit_price_kurus: price } : { expected_list_price_kurus: line.product.current_price_kurus }) }
      }),
        payment: { amount_kurus: paid, method: paid > 0 ? method as PaymentMethod : null } }
    }
    try { rememberKey(actor, 'sale', key.current) } catch { setError('Tarayıcı işlem anahtarını koruyamadı. Kayıt gönderilmedi; önceki işlemi geçmişten kontrol edin ve tarayıcı ayarlarınızı inceleyin.'); return }
    updateSaleDraft(actor, draft.key, { pending: body })
    sending.current = true; setBusy(true); setError(''); setPending(body)
    try {
      const saved = await createSale(body, key.current)
      if (mounted.current) { clearSaleDraft(actor); onSaved(saved) }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof ApiError ? cause.message : 'Satış sonucu doğrulanamadı. Aynı satışı tekrar deneyin.')
        if (cause instanceof ApiError && cause.code === 'PRICE_CHANGED') {
          const detail = cause.details as { products?: unknown } | undefined
          if (Array.isArray(detail?.products) && detail.products.every(row => row && typeof row.product_id === 'string' && typeof row.name === 'string' && Number.isSafeInteger(row.expected_list_price_kurus) && Number.isSafeInteger(row.current_price_kurus) && row.current_price_kurus >= 0)) setChangedPrices(detail.products)
          updateSaleDraft(actor, draft.key, { pending: null }); setPending(null)
        }
        // Only definitive rejection permits edits. Ambiguous failures retain exactly the original payload + key.
        if (cause instanceof ApiError && [400, 403, 413, 415, 422].includes(cause.status)) { updateSaleDraft(actor, draft.key, { pending: null }); setPending(null) }
      }
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <>
    <PageHeader title="Yeni Satış" description="Kaydettiğiniz satış, teslimatın gerçekleştiğini belirtir."
      actions={<a className="ui-button ui-button--secondary" href="#/satislar">Satış geçmişi</a>} />
    {draft.recovered && <RecoveryNotice history="#/satislar" disabled={busy} discard={() => discardSaleDraft(actor)} />}
    <form className="sale-form" onSubmit={save} noValidate aria-busy={busy}>
      <Card title="Müşteri">
        {customer ? <div className="sale-selected"><div><strong>{customer.name}</strong><p>{customer.address}</p></div>
          <Button variant="ghost" disabled={locked} onClick={() => setCustomer(null)}>Müşteriyi değiştir</Button></div>
          : <RecordPicker label="Müşteri ara" load={customers} onSelect={value => { setCustomer(value); setInvalid(current => ({ ...current, customer: undefined })) }} describe={value => value.phone || value.address} disabled={locked} />}
        {invalid.customer && <p className="sale-validation" role="alert" tabIndex={-1} data-sale-validation>{invalid.customer}</p>}
      </Card>
      <Card title="Ürünler">
        <RecordPicker label="Aktif ürün ara" load={products} onSelect={product => { setLines(current => [...current, { product, quantity: '1', unitPrice: priceInputFromKurus(product.current_price_kurus) }]); setInvalid(current => ({ ...current, items: undefined })) }}
          describe={value => formatMoney(value.current_price_kurus)} disabled={locked || lines.length >= 50} excluded={lines.map(line => line.product.id)} />
        {lines.length > 0 && <ul className="sale-lines">{lines.map((line, index) => {
          let amount: number | undefined, price: number | undefined, priceError: string | undefined, message: string | undefined
          try { price = unitPriceValue(line.unitPrice) } catch (cause) { priceError = cause instanceof Error ? cause.message : 'Geçersiz birim fiyat.' }
          try { quantityValue(line.quantity); if (price !== undefined) amount = lineTotal(price, line.quantity) }
          catch (cause) { message = cause instanceof Error ? cause.message : 'Geçersiz miktar.' }
          const customPrice = price !== undefined && price !== line.product.current_price_kurus
          return <li key={line.product.id}>
            <div className="sale-line-name"><strong>{line.product.name}</strong>
              <small>Liste fiyatı: <span className="money">{formatMoney(line.product.current_price_kurus)}</span></small>
            </div>
            <div className="sale-line-price">
              <Input label="Birim fiyat (₺)" aria-label={`${line.product.name} birim fiyatı (₺)`} type="text" inputMode="decimal" name={`unit-price-${index}`}
                value={line.unitPrice} maxLength={32} required error={priceError} disabled={locked}
                onChange={event => { setLines(current => current.map((value, at) => at === index ? { ...value, unitPrice: event.target.value } : value)); setInvalid(current => ({ ...current, items: undefined })) }} />
              {customPrice && <div className="sale-price-indicator"><Badge tone="info">Özel fiyat</Badge>
                <span className="sale-price-comparison money"><span className="visually-hidden">Liste fiyatı </span><del>{formatMoney(line.product.current_price_kurus)}</del>
                  <span aria-hidden="true"> → </span><span className="visually-hidden">Satış fiyatı </span>{formatMoney(price!)}</span>
                <Button variant="ghost" disabled={locked} aria-label={`${line.product.name} liste fiyatına dön`}
                  onClick={() => { setLines(current => current.map((value, at) => at === index ? { ...value, unitPrice: priceInputFromKurus(value.product.current_price_kurus) } : value)); setInvalid(current => ({ ...current, items: undefined })) }}>Sıfırla</Button>
              </div>}
            </div>
            <Input label="Miktar" aria-label={`${line.product.name} miktarı`} type="text" inputMode="numeric" name={`quantity-${index}`} value={line.quantity} maxLength={16} required error={message} disabled={locked}
              onChange={event => { setLines(current => current.map((value, at) => at === index ? { ...value, quantity: event.target.value } : value)); setInvalid(current => ({ ...current, items: undefined })) }} />
            <div className="sale-line-total"><small>Satır toplamı</small><strong className="money">{amount === undefined ? '—' : formatMoney(amount)}</strong></div>
            <div className="sale-line-remove"><Button variant="ghost" disabled={locked} title="Satırdan kaldır" onClick={() => setLines(current => current.filter(value => value.product.id !== line.product.id))} aria-label={`${line.product.name} satıştan kaldır`}><Icon name="trash" /></Button></div>
          </li>
        })}</ul>}
        {invalid.items && <p className="sale-validation" role="alert" tabIndex={-1} data-sale-validation>{invalid.items}</p>}
      </Card>
      <Card title="Ödeme">
        <div className="sale-payment-fields">
          <Input label="Alınan ödeme (₺)" name="payment" type="text" inputMode="decimal" value={payment} maxLength={32} required disabled={locked} error={invalid.payment}
            hint="Ödeme alınmadıysa 0 girin." onChange={event => { setPayment(event.target.value); setInvalid(current => ({ ...current, payment: undefined })) }} />
          {paid !== undefined && paid > 0 && <Select label="Ödeme yöntemi" value={method} required disabled={locked} error={invalid.method} onChange={event => { setMethod(event.target.value as PaymentMethod | ''); setInvalid(current => ({ ...current, method: undefined })) }}>
            <option value="">Seçin</option><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option>
          </Select>}
        </div>
        <dl className="sale-totals" aria-live="polite">
          <div><dt>Genel toplam</dt><dd className="money">{total === undefined ? '—' : formatMoney(total)}</dd></div>
          <div><dt>Alınan ödeme</dt><dd className="money">{paid === undefined ? '—' : formatMoney(paid)}</dd></div>
          <div><dt>Kalan borç</dt><dd className="money">{total === undefined || paid === undefined || paid > total ? '—' : formatMoney(total - paid)}</dd></div>
        </dl>
        {lines.length > 0 && paid === 0 && total !== undefined && total > 0 && <p className="sale-credit">Ödeme alınmadı. Satışın tamamı veresiye olarak kaydedilecek.</p>}
        <p className="sale-help">Özel fiyat yalnızca bu satışa uygulanır. Liste fiyatı değişirse yeniden onayınız istenir; toplamlar sunucuda doğrulanır.</p>
      </Card>
      {changedPrices.length > 0 && <Card title="Ürün fiyatı değişti">
        <ul>{changedPrices.map(row => <li key={row.product_id}><strong>{row.name}</strong>: {formatMoney(row.expected_list_price_kurus)} → {formatMoney(row.current_price_kurus)}</li>)}</ul>
        <p>Yeni fiyatı kabul ettikten sonra güncel toplamı kontrol ederek satışı tekrar kaydedin.</p>
        <Button disabled={busy} onClick={() => {
          setLines(current => current.map(line => {
            const changed = changedPrices.find(row => row.product_id === line.product.id)
            if (!changed) return line
            let catalogPrice = false
            try { catalogPrice = unitPriceValue(line.unitPrice) === line.product.current_price_kurus } catch { /* Keep the invalid input for normal form validation. */ }
            return { ...line, product: { ...line.product, current_price_kurus: changed.current_price_kurus },
              unitPrice: catalogPrice ? priceInputFromKurus(changed.current_price_kurus) : line.unitPrice }
          })); setChangedPrices([]); setError('')
        }}>Yeni fiyatı kabul et</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setChangedPrices([]); setError('') }}>Satışı düzenlemeye dön</Button>
      </Card>}
      {error && <ErrorState title="Satış kaydı doğrulanamadı" description={error} />}
      {pending && !busy && <p className="sale-credit" role="status">Sonuç belirsiz olabilir. Bilgiler korundu; sayfayı yenilemeden aynı satışı tekrar deneyin veya satış geçmişini kontrol edin.</p>}
      <div className="sale-submit"><Button type="submit" loading={busy} disabled={changedPrices.length > 0} loadingText="Satış kaydediliyor…">{pending ? 'Aynı satışı tekrar dene' : 'Satışı Kaydet'}</Button></div>
    </form>
  </>
}
