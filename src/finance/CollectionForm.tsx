import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { listCustomers, type Customer } from '../services/customers'
import { customerReceivables } from '../services/finance'
import { createCollection, previewCollection, type Collection, type CollectionInput } from '../services/collections'
import { ApiError } from '../services/apiClient'
import { RecordPicker } from '../sales/RecordPicker'
import { useResource } from '../hooks/useResource'
import { formatMoney, parsePriceToKurus } from '../utils/format'
import type { PaymentMethod } from '../services/sales'
import { rememberKey } from './pendingKey'
import { RecoveryNotice } from './RecoveryNotice'
import { collectionDraft, discardCollectionDraft, updateCollectionDraft } from './collectionDraft'
const customers = (q: string, page: number) => listCustomers({ q, page, pageSize: 5, status: 'active' })
export function CollectionForm({ actor, initialCustomer, onSaved, embedded = false, onBusyChange, onDismiss }: { actor: string; initialCustomer?: Customer; onSaved: (value: Collection) => void; embedded?: boolean; onBusyChange?: (busy: boolean) => void; onDismiss?: () => void }) {
  const [draft] = useState(() => collectionDraft(actor, initialCustomer))
  const [customer, setCustomer] = useState(draft.customer), [amount, setAmount] = useState(draft.amount), [method, setMethod] = useState(draft.method)
  const [pending, setPending] = useState(draft.pending)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const sending = useRef(false), mounted = useRef(false)
  const load = useCallback(() => customer ? customerReceivables(customer.id, { page: 1, pageSize: 1 }) : Promise.resolve(null), [customer])
  const { result, retry } = useResource(customer?.id ?? '', load)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { updateCollectionDraft(actor, { customer, amount, method, pending }) }, [actor, customer, amount, method, pending])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  const locked = busy || !!pending || draft.recovered
  function changed() { setError('') }
  function input(): CollectionInput {
    if (!customer) throw new Error('Bir müşteri seçin.')
    const kurus = parsePriceToKurus(amount)
    if (kurus <= 0) throw new Error('Tahsilat sıfırdan büyük olmalı.')
    return { customer_id: customer.id, amount_kurus: kurus, method }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (sending.current || draft.recovered) return
    let body = pending
    let requested: CollectionInput | null = null
    try { if (!body) requested = input() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Tahsilat bilgilerini kontrol edin.'); return }
    sending.current = true; setBusy(true); setError('')
    try {
      if (!body && requested) {
        // Fetch a fresh server revision, without showing a separate distribution step.
        const current = await previewCollection(requested)
        if (!mounted.current) return
        body = { ...requested, expected_balance_version: current.balance_version }
      }
      if (!body) return
      rememberKey(actor, 'collection', draft.key)
      setPending(body); updateCollectionDraft(actor, { pending: body })
      const value = await createCollection(body, draft.key)
      discardCollectionDraft(actor)
      if (mounted.current) onSaved(value)
    } catch (cause) {
      if (!mounted.current) return
      setError(cause instanceof Error ? cause.message : 'Sonuç doğrulanamadı. Aynı işlemi tekrar deneyin.')
      if (cause instanceof ApiError && ([400,403,404,413,415,422,428].includes(cause.status) || cause.code === 'COLLECTION_BALANCE_CHANGED')) {
        setPending(null); updateCollectionDraft(actor, { pending: null }); retry()
      }
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <>
    {!embedded && <PageHeader title="Tahsilat Al" description="Ödeme en eski açık satışlardan başlayarak otomatik dağıtılır." actions={<a className="ui-button ui-button--secondary" href="#/tahsilatlar">Tahsilat geçmişi</a>} />}
    {draft.recovered && <RecoveryNotice history="#/tahsilatlar" disabled={busy} discard={() => { const cleared = discardCollectionDraft(actor); if (cleared) onDismiss?.(); return cleared }} />}
    <form className="finance-form" onSubmit={save} noValidate aria-busy={busy}>
      <Card title="Müşteri Seçimi">
        {customer ? <div className="finance-selected"><div><strong>{customer.name}</strong><p>{[customer.phone, customer.address?.slice(0, 140)].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" disabled={locked} onClick={() => { changed(); setCustomer(null) }}>Müşteriyi değiştir</Button></div>
          : <RecordPicker searchRequired label="Müşteri ara…" load={customers} describe={c => [c.phone, c.address?.slice(0, 140)].filter(Boolean).join(' · ')} disabled={locked} onSelect={c => { changed(); setCustomer(c) }} />}
        {customer && (!result ? <LoadingState label="Güncel borç yükleniyor…" /> : result.error ? <ErrorState title="Borç alınamadı" description={result.error} onRetry={retry} />
          : result.data ? <p className="money--prominent">Güncel kalan borç: {formatMoney(result.data.summary.total_debt_kurus)}</p> : <ErrorState title="Borç doğrulanamadı" description="Lütfen tekrar deneyin." onRetry={retry} />)}
      </Card>
      <Card title="Tahsilat bilgileri"><div className="finance-fields">
        <Input label="Tahsil edilecek tutar (₺)" inputMode="decimal" value={amount} required disabled={locked} maxLength={32} onChange={e => { changed(); setAmount(e.target.value) }} />
        <Select label="Ödeme yöntemi" value={method} required disabled={locked} onChange={e => { changed(); setMethod(e.target.value as PaymentMethod) }}><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option></Select>
      </div></Card>
      {error && <ErrorState title="Tahsilat tamamlanamadı" description={error} />}
      {pending && !busy && <p role="status">Sonuç belirsiz olabilir. Bilgiler ve işlem anahtarı korundu; aynı tahsilatı tekrar deneyin.</p>}
      <div><Button type="submit" loading={busy} disabled={draft.recovered || !customer}>{pending ? 'Aynı tahsilatı tekrar dene' : 'Tahsilatı tamamla'}</Button></div>
    </form>
  </>
}
