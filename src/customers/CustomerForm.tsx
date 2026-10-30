import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input, Textarea } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { ApiError } from '../services/apiClient'
import { getCustomer, createCustomer, updateCustomer, type Customer, type CustomerInput, type CustomerPatch } from '../services/customers'
import type { Role } from '../services/auth'
import { customerHref } from './routing'

type Fields = { name: string; phone: string; address: string; delivery_notes: string }
export function CustomerForm({ customer: initialRecord, role, onSaved }: { customer?: Customer; role: Role; onSaved: (customer: Customer) => void }) {
  const [customer, setBase] = useState(initialRecord)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false), [review, setReview] = useState(false)
  const pending = useRef<{ body: CustomerPatch; version: number; key: string } | null>(null)

  const [values, setValues] = useState<Fields>({ name: customer?.name ?? '', phone: customer?.phone ?? '', address: customer?.address ?? '', delivery_notes: customer?.delivery_notes ?? '' })
  const [active, setActive] = useState(customer?.is_active ?? true)
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestKey = useRef(crypto.randomUUID())
  const sending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const back = customer ? customerHref(customer.id) : '#/musteriler'
  const input: CustomerInput = { name: values.name.trim().normalize('NFC'), phone: values.phone.trim().normalize('NFKC').replace(/[\u2010-\u2015\u2212]/g, '-') || null,
    address: values.address.trim().normalize('NFC'), delivery_notes: values.delivery_notes.trim() || null }
  const patch: CustomerPatch = {}
  if (customer) {
    for (const field of ['name', 'phone', 'address', 'delivery_notes'] as const) if (input[field] !== customer[field]) Object.assign(patch, { [field]: input[field] })
    if (role === 'admin' && active !== customer.is_active) patch.is_active = active
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    const invalid: typeof errors = {}
    if (!input.name) invalid.name = 'Müşteri adını girin.'
    else if (input.name.length > 160) invalid.name = 'Müşteri adı en fazla 160 karakter olabilir.'
    if (!input.address) invalid.address = 'Teslimat adresini girin.'
    else if (input.address.length > 1000) invalid.address = 'Adres en fazla 1000 karakter olabilir.'
    if (input.delivery_notes && input.delivery_notes.length > 2000) invalid.delivery_notes = 'Teslimat notu en fazla 2000 karakter olabilir.'
    if (input.phone) {
      const digits = (input.phone.split(/x|ext\.?|dahili/i)[0] ?? '').replace(/\D/g, '').replace(/^00/, '').length
      if (!/^\+?[\d () .-]+(?:\s*(?:x|ext\.?|dahili)\s*\d{1,6})?$/i.test(input.phone) || digits < 7 || digits > 15) invalid.phone = 'Telefon numarası 7–15 rakam içermeli. Ülke kodu ve dahili kullanılabilir.'
    }
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus()
      return
    }
    if (customer && Object.keys(patch).length === 0) return
    if (conflict) return
    if (customer) pending.current ??= { body: structuredClone(patch), version: customer.version, key: requestKey.current }
    setUncertain(!!pending.current)
    sending.current = true
    setBusy(true)
    setError('')
    try {
      const saved = customer ? await updateCustomer(customer.id, pending.current!.body, pending.current!.version, pending.current!.key) : await createCustomer(input, requestKey.current)
      if (mounted.current) onSaved(saved)
    } catch (cause) {
      if (cause instanceof ApiError && [400,403,404,409,413,415,422,428].includes(cause.status)) { pending.current = null; setUncertain(false) }
      if (cause instanceof ApiError && cause.code === 'RECORD_VERSION_CONFLICT') setConflict(true)
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'Müşteri kaydedilemedi. Lütfen tekrar deneyin.')
    } finally {
      sending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function change(field: keyof Fields, value: string) {
    setValues(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  async function refresh() { if (!customer || sending.current) return
    setBusy(true)
    try {
      const latest = await getCustomer(customer.id)
      setValues(current => Object.fromEntries((['name','phone','address','delivery_notes'] as const).map(field => [field, input[field] === customer[field] ? latest[field] ?? '' : current[field]])) as Fields)
      if (active === customer.is_active) setActive(latest.is_active)
      setBase(latest); setConflict(false); setReview(true); setError(''); requestKey.current = crypto.randomUUID()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Güncel kayıt alınamadı.') } finally { setBusy(false) } }
  return <>
    <PageHeader title={customer ? 'Müşteriyi düzenle' : 'Yeni müşteri'} description={customer ? 'Müşteri bilgilerini ve teslimat notlarını güncelleyin.' : 'Müşterinin iletişim ve teslimat bilgilerini kaydedin.'} />
    <Card title="Müşteri bilgileri" className="customer-form-panel">
      <form className="customer-form" onSubmit={save} noValidate aria-busy={busy}>
        <Input label="Müşteri adı" name="name" autoComplete="name" value={values.name} maxLength={160} required disabled={busy || uncertain} error={errors.name} onChange={event => change('name', event.target.value)} />
        <Input label="Telefon (isteğe bağlı)" name="phone" type="tel" autoComplete="tel" value={values.phone} maxLength={64} disabled={busy || uncertain} error={errors.phone}
          hint="Ülke kodu, boşluk ve parantez kullanabilirsiniz. Varsa dahiliyi sona ekleyin." onChange={event => change('phone', event.target.value)} />
        <Textarea label="Adres" name="address" autoComplete="street-address" value={values.address} rows={3} maxLength={1000} required disabled={busy || uncertain} error={errors.address} onChange={event => change('address', event.target.value)} />
        <Textarea label="Teslimat notu (isteğe bağlı)" name="delivery_notes" value={values.delivery_notes} rows={3} maxLength={2000} disabled={busy || uncertain} error={errors.delivery_notes} onChange={event => change('delivery_notes', event.target.value)} />
        {customer && role === 'admin' && <label className="customer-active-field"><input name="is_active" type="checkbox" checked={active} disabled={busy || uncertain} onChange={event => setActive(event.target.checked)} />Aktif müşteri</label>}
        {conflict && <div role="status"><p>Bu kayıt başka bir kullanıcı tarafından değiştirildi. Yazdığınız bilgiler korunuyor.</p><Button disabled={busy} onClick={() => { void refresh() }}>Güncel bilgileri yükle</Button></div>}
        {review && customer && <div role="status"><p>Düzenlediğiniz alanlar korundu. Güncel kayıtla karşılaştırıp tekrar onaylayın.</p><details><summary>Sunucudaki güncel bilgiler</summary><p>{customer.name}</p><p>{customer.address}<br />{customer.phone}<br />{customer.delivery_notes}</p></details></div>}
        {uncertain && !busy && <p role="status">Yanıt doğrulanamadı. Bilgiler kilitlendi; aynı güncellemeyi tekrar deneyin.</p>}
        {error && <ErrorState title="Müşteri kaydedilemedi" description={error} />}
        <div className="customer-form-actions">
          <Button type="submit" loading={busy} loadingText="Kaydediliyor…" disabled={conflict || (!!customer && Object.keys(patch).length === 0)}>{customer ? 'Değişiklikleri kaydet' : 'Müşteriyi kaydet'}</Button>
          <Button variant="ghost" disabled={busy || uncertain} onClick={() => { window.location.hash = back }}>Vazgeç</Button>
        </div>
      </form>
    </Card>
  </>
}
