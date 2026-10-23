import { useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { ApiError } from '../services/apiClient'
import { resetUserPassword, type ManagedUser } from '../services/users'
import { UserDialog } from './UserDialog'
import { checkSession } from '../auth/sessionStore'

export function PasswordReset({ account, actor, onSaved }: { account: ManagedUser; actor: string; onSaved: (user: ManagedUser) => void }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [invalid, setInvalid] = useState('')
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [pending, setPending] = useState<string | null>(null)
  const key = useRef(crypto.randomUUID()), sending = useRef(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.trim().length < 15 || password.length > 128) { setInvalid('15–128 karakterlik benzersiz bir parola girin.'); return }
    if (password !== confirmation) { setInvalid('Parolalar eşleşmiyor.'); return }
    setInvalid(''); setOpen(true)
  }
  async function save() {
    if (sending.current) return
    sending.current = true; setBusy(true); setError(''); setPending(pending ?? password)
    try {
      const user = await resetUserPassword(account.id, pending ?? password, key.current)
      setPassword(''); setConfirmation(''); setPending(null); setOpen(false)
      if (actor === account.id) await checkSession()
      else onSaved(user)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Parola sıfırlama sonucu doğrulanamadı. Aynı işlemle tekrar deneyin.')
      if (cause instanceof ApiError && [400, 403, 404, 413, 415, 422].includes(cause.status)) { setPending(null); key.current = crypto.randomUUID() }
    } finally { sending.current = false; setBusy(false) }
  }
  return <>
    <PageHeader title="Parola sıfırla" description={`${account.username} hesabı için yeni parola belirleyin.`} />
    <Card title="Yeni parola" className="user-form-panel"><form className="user-form" onSubmit={submit} noValidate>
      <Input label="Yeni parola" type="password" name="password" autoComplete="new-password" required maxLength={128} value={password} disabled={busy || !!pending} error={invalid}
        hint="Parola yalnızca bu formda tutulur; kaydedilen parola daha sonra görüntülenemez." onChange={event => setPassword(event.target.value)} />
      <Input label="Yeni parola tekrarı" type="password" autoComplete="new-password" required maxLength={128} value={confirmation} disabled={busy || !!pending} onChange={event => setConfirmation(event.target.value)} />
      <p className="user-help">Bu hesabın tüm mevcut oturumları iptal edilecek. Yeni parolayı kullanıcıya güvenli bir kanaldan iletin.</p>
      {error && !open && <ErrorState title="Parola sıfırlanamadı" description={error} />}
      <div className="user-actions"><Button type="submit" disabled={busy}>{pending ? 'Aynı sıfırlamayı tekrar dene' : 'Parolayı sıfırla'}</Button><a className="ui-button ui-button--ghost" href={'#/calisanlar/' + account.id}>Hesaba dön</a></div>
    </form></Card>
    {open && <UserDialog title="Parola sıfırlamayı onaylayın" busy={busy} close={() => setOpen(false)} confirm={() => { void save() }} label="Parolayı Sıfırla ve Oturumları Kapat">
      <p>{account.username} için eski parola geçersiz olacak ve tüm oturumlar kapatılacak.</p>
      {actor === account.id && <p>Kendi parolanızı sıfırlıyorsunuz. Yeniden giriş yapmanız gerekecek.</p>}
      {error && <ErrorState title="Parola sıfırlanamadı" description={error} />}
    </UserDialog>}
  </>
}
