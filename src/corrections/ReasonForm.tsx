import { useState, type FormEvent } from 'react'
import { Button, Textarea } from '../components/ui'
import { useOperation } from './operation'

export function ReasonForm({ actor, scope, label, send, onSaved, onClose, onBusyChange, danger = false }: {
  actor: string; scope: string; label: string; send: (body: { reason: string }, key: string) => Promise<unknown>;
  onSaved: () => void; onClose?: () => void; onBusyChange?: (busy: boolean) => void; danger?: boolean
}) {
  const operation = useOperation(actor, scope, send)
  const [reason, setReason] = useState(() => operation.saved?.reason ?? ''), [validation, setValidation] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) { setValidation('Gerekçe girin.'); return }
    if (operation.busy) return
    setValidation(''); onBusyChange?.(true)
    try { if (await operation.run({ reason: reason.trim() })) onSaved() } finally { onBusyChange?.(false) }
  }
  return <form className="correction-form" onSubmit={submit}>
    <Textarea label="Gerekçe" required maxLength={1000} rows={3} value={reason} disabled={!!operation.saved || operation.busy}
      error={validation} onChange={event => setReason(event.target.value)} />
    {operation.busy && <p role="status">İşlem sürüyor. Sonuç alınana kadar bu pencere açık kalacak.</p>}
    {operation.error && <p role="alert" className="finance-validation">{operation.error}</p>}
    {operation.saved && !operation.busy && <p className="sale-help">Yanıt doğrulanamadı. Bilgiler kilitlendi; aynı işlem anahtarıyla tekrar deneyebilir veya güncel kaydı kontrol edebilirsiniz.</p>}
    <div className="finance-actions">
      {onClose && <Button variant="secondary" disabled={operation.busy} onClick={onClose}>Vazgeç</Button>}
      <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={operation.busy}>{operation.saved ? 'Aynı işlemi tekrar dene' : label}</Button>
    </div>
  </form>
}
