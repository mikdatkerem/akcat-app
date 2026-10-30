import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { ApiError } from '../services/apiClient'
import { getProduct, createProduct, updateProduct, type Product, type ProductPatch } from '../services/products'
import { parsePriceToKurus, priceInputFromKurus } from '../utils/format'
import { productHref } from './routing'

// Rendered only after the admin UI guard. The API independently enforces write authorization.
export function ProductForm({ product: initialRecord, onSaved }: { product?: Product; onSaved: (product: Product) => void }) {
  const [product, setBase] = useState(initialRecord)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false), [review, setReview] = useState(false)
  const pending = useRef<{ body: ProductPatch; version: number; key: string } | null>(null)

  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? priceInputFromKurus(product.current_price_kurus) : '')
  const [active, setActive] = useState(product?.is_active ?? true)
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestKey = useRef(crypto.randomUUID())
  const sending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  let amount: number | undefined
  try { amount = parsePriceToKurus(price) } catch { /* Validation is presented on submit. */ }
  const normalizedName = name.trim().normalize('NFC')
  const patch: ProductPatch = {}
  if (product) {
    if (normalizedName !== product.name) patch.name = normalizedName
    if (amount !== product.current_price_kurus) patch.current_price_kurus = amount
    if (active !== product.is_active) patch.is_active = active
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    const invalid: typeof errors = {}
    if (!normalizedName) invalid.name = 'Ürün adını girin.'
    else if (normalizedName.length > 160) invalid.name = 'Ürün adı en fazla 160 karakter olabilir.'
    let kurus: number | undefined
    try { kurus = parsePriceToKurus(price) } catch (cause) { invalid.price = cause instanceof RangeError ? cause.message : 'Geçerli bir fiyat girin.' }
    setErrors(invalid)
    if (Object.keys(invalid).length || kurus === undefined) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus()
      return
    }
    if (product && Object.keys(patch).length === 0) return
    if (conflict) return
    if (product) pending.current ??= { body: structuredClone(patch), version: product.version, key: requestKey.current }
    setUncertain(!!pending.current)
    sending.current = true
    setBusy(true)
    setError('')
    try {
      const saved = product ? await updateProduct(product.id, pending.current!.body, pending.current!.version, pending.current!.key) : await createProduct({ name: normalizedName, current_price_kurus: kurus, is_active: active }, requestKey.current)
      if (mounted.current) onSaved(saved)
    } catch (cause) {
      if (cause instanceof ApiError && [400,403,404,409,413,415,422,428].includes(cause.status)) { pending.current = null; setUncertain(false) }
      if (cause instanceof ApiError && cause.code === 'RECORD_VERSION_CONFLICT') setConflict(true)
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'Ürün kaydedilemedi. Lütfen tekrar deneyin.')
    } finally {
      sending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function refresh() { if (!product || sending.current) return
    setBusy(true)
    try {
      const latest = await getProduct(product.id)
      if (normalizedName === product.name) setName(latest.name)
      if (amount === product.current_price_kurus) setPrice(priceInputFromKurus(latest.current_price_kurus))
      if (active === product.is_active) setActive(latest.is_active)
      setBase(latest); setConflict(false); setReview(true); setError(''); requestKey.current = crypto.randomUUID()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Güncel kayıt alınamadı.') } finally { setBusy(false) } }
  return <>
    <PageHeader title={product ? 'Ürünü düzenle' : 'Yeni ürün'} description="Ürün adını, güncel satış fiyatını ve aktiflik durumunu yönetin." />
    <Card title="Ürün bilgileri" className="product-form-panel">
      <form className="product-form" onSubmit={save} noValidate aria-busy={busy}>
        <Input label="Ürün adı" name="name" value={name} maxLength={160} required disabled={busy || uncertain} error={errors.name}
          onChange={event => { setName(event.target.value); setErrors(current => ({ ...current, name: undefined })) }} />
        <Input label="Satış fiyatı (₺)" name="price" type="text" inputMode="decimal" value={price} maxLength={32} required disabled={busy || uncertain} error={errors.price}
          hint="Binlik ayırıcı kullanmayın. Virgül veya nokta ile en fazla iki ondalık basamak girin."
          onChange={event => { setPrice(event.target.value); setErrors(current => ({ ...current, price: undefined })) }} />
        <label className="product-active-field"><input name="is_active" type="checkbox" checked={active} disabled={busy || uncertain} onChange={event => setActive(event.target.checked)} />Aktif ürün</label>
        {conflict && <div role="status"><p>Bu kayıt başka bir kullanıcı tarafından değiştirildi. Yazdığınız bilgiler korunuyor.</p><Button disabled={busy} onClick={() => { void refresh() }}>Güncel bilgileri yükle</Button></div>}
        {review && product && <div role="status"><p>Düzenlediğiniz alanlar korundu. Güncel kayıtla karşılaştırıp tekrar onaylayın.</p><details><summary>Sunucudaki güncel bilgiler</summary><p>{product.name}</p><p>{priceInputFromKurus(product.current_price_kurus)} ₺</p></details></div>}
        {uncertain && !busy && <p role="status">Yanıt doğrulanamadı. Bilgiler kilitlendi; aynı güncellemeyi tekrar deneyin.</p>}
        {error && <ErrorState title="Ürün kaydedilemedi" description={error} />}
        <div className="product-form-actions">
          <Button type="submit" loading={busy} loadingText="Kaydediliyor…" disabled={conflict || (!!product && Object.keys(patch).length === 0)}>{product ? 'Değişiklikleri kaydet' : 'Ürünü kaydet'}</Button>
          <Button variant="ghost" disabled={busy || uncertain} onClick={() => { window.location.hash = product ? productHref(product.id) : '#/urunler' }}>Vazgeç</Button>
        </div>
      </form>
    </Card>
  </>
}
