import { useRef, useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, Input, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { ApiError } from '../services/apiClient'
import { createUser, updateUser, type ManagedUser, type UserInput, type UserPatch } from '../services/users'
import type { Role } from '../services/auth'
import { UserDialog } from './UserDialog'

export function UserForm({ account, actor, onSaved }: { account?: ManagedUser; actor: string; onSaved: (user: ManagedUser) => void }) {
  const [username, setUsername] = useState(account?.username ?? ''), [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(account?.role ?? 'employee'), [active, setActive] = useState(account?.is_active ?? true)
  const [fields, setFields] = useState<{ username?: string; password?: string }>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<UserInput | UserPatch | null>(null), [confirm, setConfirm] = useState<UserInput | UserPatch | null>(null)
  const key = useRef(crypto.randomUUID()), sending = useRef(false), own = account?.id === actor, locked = busy || !!pending
  async function send(body: UserInput | UserPatch) {
    if (sending.current) return
    sending.current = true; setBusy(true); setError(''); setPending(body)
    try {
      const result = account ? await updateUser(account.id, body, key.current) : await createUser(body as UserInput, key.current)
      setPassword(''); setPending(null); setConfirm(null); onSaved(result)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Hesap kaydının sonucu doğrulanamadı. Aynı bilgilerle tekrar deneyin.')
      if (cause instanceof ApiError && ([400, 403, 404, 413, 415, 422].includes(cause.status) || cause.code === 'USERNAME_TAKEN')) {
        setPending(null); key.current = crypto.randomUUID()
      }
    } finally { sending.current = false; setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) { void send(pending); return }
    const normalized = username.normalize('NFKC').trim().toLocaleLowerCase('tr-TR'), invalid: typeof fields = {}
    if (normalized.length < 3 || normalized.length > 64 || !/^[\p{L}\p{N}._-]+$/u.test(normalized)) invalid.username = '3–64 harf/rakam veya . _ - kullanın.'
    if (!account && (password.trim().length < 15 || password.length > 128)) invalid.password = '15–128 karakterlik benzersiz bir parola girin.'
    setFields(invalid)
    if (Object.keys(invalid).length) { event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    const body: UserInput | UserPatch = account ? { username: normalized, role, is_active: active } : { username: normalized, password, role }
    if (account && normalized === account.username && role === account.role && active === account.is_active) return
    if ((!account && role === 'admin') || (account && (role !== account.role || active !== account.is_active))) setConfirm(body)
    else void send(body)
  }
  return <>
    <PageHeader title={account ? 'Çalışanı düzenle' : 'Çalışan ekle'} description="Hesapları yalnızca yöneticiler yönetebilir. Finansal geçmiş korunur." />
    <Card title="Hesap bilgileri" className="user-form-panel"><form className="user-form" noValidate onSubmit={submit} aria-busy={busy}>
      <Input label="Kullanıcı adı" name="username" value={username} required maxLength={128} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={locked} error={fields.username} onChange={event => setUsername(event.target.value)} />
      {!account && <Input label="Başlangıç parolası" name="password" type="password" value={password} autoComplete="new-password" required maxLength={128} disabled={locked} error={fields.password}
        hint="15–128 karakter; benzersiz, uzun bir parola kullanın. Kullanıcıya güvenli bir kanaldan iletin." onChange={event => setPassword(event.target.value)} />}
      <Select label="Rol" value={role} disabled={locked || own} onChange={event => setRole(event.target.value as Role)}><option value="employee">Çalışan</option><option value="admin">Admin</option></Select>
      {account && <Select label="Hesap durumu" value={active ? 'active' : 'inactive'} disabled={locked || own} onChange={event => setActive(event.target.value === 'active')}><option value="active">Aktif</option><option value="inactive">Pasif</option></Select>}
      {own && <p className="user-help">Kendi hesabınızı pasife alamaz veya admin rolünüzü düşüremezsiniz.</p>}
      {error && !confirm && <ErrorState title="Hesap kaydedilemedi" description={error} />}
      {pending && !busy && <p className="user-help" role="status">Yanıt belirsizse aynı bilgiler ve işlem anahtarı korunur. Yeni hesap açmadan önce listeyi kontrol edin.</p>}
      <div className="user-actions"><Button type="submit" loading={busy} loadingText="Kaydediliyor…">{pending ? 'Aynı kaydı tekrar dene' : account ? 'Değişiklikleri kaydet' : 'Hesabı oluştur'}</Button>
        <a className="ui-button ui-button--ghost" href={account ? '#/calisanlar/' + account.id : '#/calisanlar'}>Listeye dön</a></div>
    </form></Card>
    {confirm && <UserDialog title="Hesap değişikliğini onaylayın" busy={busy} close={() => setConfirm(null)} confirm={() => { void send(confirm) }} label="Değişikliği Onayla">
      <p>{account?.username ?? username} hesabının rolü <strong>{role === 'admin' ? 'Admin' : 'Çalışan'}</strong> olacak.{account && <> Hesap <strong>{active ? 'aktif' : 'pasif'}</strong> olacak.</>}</p>
      {!active && <p>Tüm mevcut oturumlar iptal edilir. Satış, tahsilat ve audit geçmişi silinmez.</p>}
      {error && <ErrorState title="Değişiklik kaydedilemedi" description={error} />}
    </UserDialog>}
  </>
}
