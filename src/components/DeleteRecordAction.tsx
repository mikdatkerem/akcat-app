import { useEffect, useRef, useState } from 'react'
import { Button, DeleteConfirmation, Icon } from './ui'
import { ApiError } from '../services/apiClient'

export function DeleteRecordAction({ recordName, title, description, remove, onDeleted, disabledReason }: {
  recordName: string; title: string; description: string; remove: (key: string) => Promise<void>; onDeleted: () => void; disabledReason?: string
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const key = useRef<string | null>(null), sending = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function confirm() {
    if (sending.current || disabledReason) return
    sending.current = true; setBusy(true); setError('')
    try {
      // Preserve the operation across ambiguous failures and closing/reopening the same dialog.
      key.current ??= crypto.randomUUID()
      await remove(key.current)
      if (mounted.current) { setOpen(false); onDeleted() }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : 'Silme sonucu doğrulanamadı. Aynı işlemi tekrar deneyin veya listeyi yenileyin.')
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  return <>
    <Button variant="danger" disabled={!!disabledReason || busy} aria-label={`${recordName} kalıcı olarak sil`}
      onClick={() => { setError(''); setOpen(true) }}><Icon name="trash" />Sil</Button>
    {disabledReason && <small className="record-action-hint">{disabledReason}</small>}
    {open && <DeleteConfirmation title={title} description={description} busy={busy} close={() => setOpen(false)} confirm={() => { void confirm() }}>
      <p className="ui-delete-name"><strong>{recordName}</strong></p>
      {error && <p className="record-action-error" role="alert">{error}</p>}
    </DeleteConfirmation>}
  </>
}
