import { useRef, useState, type FormEvent } from 'react'
import { Badge, Button, Card, ErrorState, Input, LoadingState } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { PageHeader } from '../pages/PageHeader'
import { ApiError } from '../services/apiClient'
import { changePassword, getAccount } from '../services/auth'
import { checkSession, passwordChanged } from '../auth/sessionStore'
import './account.css'

const fields = [
  { key: 'current', label: 'Mevcut parola', complete: 'current-password' },
  { key: 'next', label: 'Yeni parola', complete: 'new-password' },
  { key: 'confirmation', label: 'Yeni parola tekrarı', complete: 'new-password' },
] as const
type PasswordField = typeof fields[number]['key']

function PasswordChange() {
  const [values, setValues] = useState({ current: '', next: '', confirmation: '' })
  const [visible, setVisible] = useState<Partial<Record<PasswordField, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const submitting = useRef(false), form = useRef<HTMLFormElement>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || uncertain) return
    const invalid: typeof errors = {}
    if (!values.current) invalid.current = 'Mevcut parolanızı girin.'
    if (values.next.trim().length < 15 || values.next.length > 128) invalid.next = 'Yeni parola 15–128 karakter olmalı; kenar boşlukları uzunluğa sayılmaz.'
    else if (values.current === values.next) invalid.next = 'Yeni parola mevcut parolanızdan farklı olmalı.'
    if (!values.confirmation || values.next !== values.confirmation) invalid.confirmation = 'Yeni parolalar eşleşmeli.'
    setErrors(invalid); setError(null)
    if (Object.keys(invalid).length) {
      form.current?.querySelector<HTMLInputElement>(`[name="${fields.find(field => invalid[field.key])?.key}"]`)?.focus()
      return
    }
    submitting.current = true; setBusy(true)
    try {
      await changePassword(values.current, values.next)
      setValues({ current: '', next: '', confirmation: '' })
      passwordChanged()
    } catch (failure) {
      const unknown = !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500
      setUncertain(unknown)
      setError(unknown
        ? 'Parola değişikliğinin sonucu doğrulanamadı; parola değişmiş olabilir. Oturumunuzu kontrol edin. Oturum kapandıysa yeni parolanızla giriş yapmayı deneyin.'
        : failure.message)
    } finally { submitting.current = false; setBusy(false) }
  }
  return <Card title="Parola değiştir" description="Değişiklikten sonra bu cihaz dahil tüm oturumlarınız kapatılır; yeni parolanızla tekrar giriş yapmanız gerekir.">
    <form ref={form} className="account-password-form" onSubmit={submit} noValidate aria-busy={busy}>
      {fields.map(field => <Input key={field.key} id={`account-${field.key}`} name={field.key} label={field.label} required
        autoComplete={field.complete} type={visible[field.key] ? 'text' : 'password'} maxLength={128}
        value={values[field.key]} disabled={busy || uncertain} error={errors[field.key]}
        hint={field.key === 'next' ? 'En az 15, en fazla 128 karakter. Uzun ve benzersiz bir parola kullanın.' : undefined}
        onChange={event => { setValues(current => ({ ...current, [field.key]: event.target.value })); setErrors(current => ({ ...current, [field.key]: undefined })) }}
        endAdornment={<Button variant="ghost" className="password-toggle" disabled={busy || uncertain}
          aria-label={`${field.label}: ${visible[field.key] ? 'gizle' : 'göster'}`} aria-controls={`account-${field.key}`} aria-pressed={!!visible[field.key]}
          onClick={() => setVisible(current => ({ ...current, [field.key]: !current[field.key] }))}>{visible[field.key] ? 'Gizle' : 'Göster'}</Button>} />)}
      {error && <ErrorState title="Parola değiştirilemedi" description={error} />}
      {uncertain ? <Button variant="secondary" onClick={() => { void checkSession() }}>Oturumu kontrol et</Button>
        : <Button type="submit" loading={busy} loadingText="Parola değiştiriliyor…">Parolayı değiştir</Button>}
    </form>
  </Card>
}

export function AccountPage() {
  const { result, retry } = useResource('account', getAccount)
  return <>
    <PageHeader title="Hesabım" description="Hesap bilgileriniz ve parola güvenliği." />
    {!result ? <LoadingState label="Hesap bilgileri yükleniyor…" /> : result.error || !result.data
      ? <ErrorState title="Hesap bilgileri alınamadı" description={result.error ?? 'Hesap bilgisi doğrulanamadı.'} onRetry={retry} />
      : <div className="account-content">
        <Card title="Hesap bilgileri"><dl className="account-summary">
          <div><dt>Kullanıcı adı</dt><dd>{result.data.username}</dd></div>
          <div><dt>Mevcut rol</dt><dd>{result.data.role === 'admin' ? 'Admin' : 'Çalışan'}</dd></div>
          <div><dt>Hesap durumu</dt><dd><Badge tone={result.data.is_active ? 'success' : 'neutral'}>{result.data.is_active ? 'Aktif' : 'Pasif'}</Badge></dd></div>
        </dl></Card>
        <PasswordChange />
      </div>}
  </>
}
