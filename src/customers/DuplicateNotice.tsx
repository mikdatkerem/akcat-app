import { useEffect, useRef, useState, type RefObject } from 'react'
import { Button } from '../components/ui'
import { apiRequest } from '../services/apiClient'
import type { Customer, CustomerInput } from '../services/customers'
import { customerHref } from './routing'
import './duplicates.css'

import { readDuplicates, type DuplicateResult, type DuplicateChallenge } from '../services/customerDuplicates'
export function DuplicateNotice({ input, customer }: { input: CustomerInput; customer?: Customer }) {
  const unchanged = customer && input.name === customer.name && input.phone === customer.phone && input.address === customer.address
    && input.latitude === (customer.latitude ?? null) && input.longitude === (customer.longitude ?? null)
  const mainPhone = input.phone?.split(/dahili|ext|x/i)[0]?.replace(/\D/g, '') ?? ''
  const payload = JSON.stringify({ name: input.name, phone: mainPhone.length >= 7 ? input.phone : null,
    address: input.address, latitude: input.latitude, longitude: input.longitude, exclude_id: customer?.id })
  const enabled = input.name.trim().length >= 3 && !unchanged
  const [state, setState] = useState<{ key: string; result?: DuplicateResult; failed?: boolean }>()
  useEffect(() => {
    if (!enabled) return
    let current = true
    const timer = window.setTimeout(() => {
      void apiRequest('/api/v1/customers/check-duplicates', { method: 'POST', body: JSON.parse(payload) })
        .then(value => { if (current) setState({ key: payload, result: readDuplicates(value) }) })
        .catch(() => { if (current) setState({ key: payload, failed: true }) })
    }, 450)
    return () => { current = false; window.clearTimeout(timer) }
  }, [payload, enabled])
  if (!enabled || state?.key !== payload) return null
  if (state.failed) return <p className="duplicate-hint" role="status">Benzer müşteri ön kontrolü yapılamadı. Kaydederken sunucuda tekrar kontrol edilecek.</p>
  if (!state.result?.matches.length) return null
  return <details className="duplicate-preview">
    <summary>{state.result.same_name_count > 0 ? `Bu isimde ${state.result.same_name_count} müşteri zaten kayıtlı.` : 'Benzer bilgilerle kayıtlı müşteriler var.'} Görüntüle</summary>
    <MatchList result={state.result} />
  </details>
}
function MatchList({ result, disabled = false }: { result: DuplicateResult; disabled?: boolean }) {
  return <><ul className="duplicate-matches">{result.matches.map(match => <li key={match.id}>
    <strong>{match.name}</strong>{!match.is_active && <span> · Pasif</span>}
    <p>Telefon: {match.phone_masked ?? 'Belirtilmedi'}<br />Adres: {match.address_short || 'Belirtilmedi'}</p>
    <p className="duplicate-hint">{match.strength === 'strong' ? 'Aynı isim ve telefon veya ayrıntılı adres eşleşiyor.'
      : match.reasons.includes('same_phone') ? 'Telefon eşleşiyor; isim farklı olabilir.' : 'İsim benzerliği tek başına mükerrer kayıt anlamına gelmez.'}</p>
    <a className="text-link" href={customerHref(match.id)} target="_blank" rel="noopener noreferrer"
      aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={event => { if (disabled) event.preventDefault() }}>Mevcut Müşteriyi Görüntüle<span className="visually-hidden"> — yeni sekme, {match.name}</span></a>
  </li>)}</ul>{result.truncated && <p>İlk 10 eşleşme gösteriliyor.</p>}</>
}
export function DuplicateConfirmation({ challenge, busy, onCancel, onConfirm, returnFocus }: {
  challenge: DuplicateChallenge; busy: boolean; onCancel: () => void; onConfirm: () => void; returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const ref = useRef<HTMLDialogElement>(null), busyRef = useRef(busy)
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => {
    const dialog = ref.current
    if (!busy && dialog?.open && !dialog.contains(document.activeElement)) dialog.querySelector<HTMLElement>('button[data-cancel]')?.focus()
  }, [busy, challenge.confirmation])
  useEffect(() => {
    const dialog = ref.current!, active = returnFocus.current ?? document.activeElement as HTMLElement | null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'; dialog.showModal()
    dialog.querySelector<HTMLElement>('button[data-cancel]')?.focus()
    return () => { dialog.close(); document.documentElement.style.overflow = overflow; if (active?.isConnected) active.focus({ preventScroll: true }) }
  }, [returnFocus])
  return <dialog ref={ref} tabIndex={-1} className="duplicate-dialog" aria-labelledby="duplicate-title" aria-describedby="duplicate-description"
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const dialog = event.currentTarget
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]:not([aria-disabled="true"])')).filter(element => element.getClientRects().length)
      const first = targets[0], last = targets[targets.length - 1], active = document.activeElement
      if (!first) { event.preventDefault(); dialog.focus() }
      else if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus() }
    }}
    aria-busy={busy} onCancel={e => { e.preventDefault(); if (!busyRef.current) onCancel() }} onClick={e => {
      if (e.target !== e.currentTarget || busyRef.current) return
      const r = e.currentTarget.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onCancel()
    }}>
    <h2 id="duplicate-title">Benzer Müşteri Bulundu</h2>
    <p id="duplicate-description">Girdiğiniz bilgilerle güçlü benzerlik gösteren müşteri kayıtları var. Yine de kaydetmek istiyor musunuz?</p>
    <MatchList result={challenge} disabled={busy} />
    <div className="duplicate-dialog-actions"><Button data-cancel variant="secondary" disabled={busy} onClick={onCancel}>İptal</Button>
      <Button loading={busy} loadingText="Kaydediliyor…" onClick={onConfirm}>Yine de Kaydet</Button></div>
  </dialog>
}
