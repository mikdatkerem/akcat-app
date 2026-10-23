import { useRef, useState, type FormEvent } from 'react'
import { Button, ErrorState, Input } from '../components/ui'
import { signIn } from './sessionStore'
import { AuthScreen } from './AuthScreen'

export function LoginPage({ busy, error, notice }: { busy: boolean; error: string | null; notice?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [fields, setFields] = useState<{ username?: string; password?: string }>({})
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const errors: typeof fields = {}
    if (!username.trim()) errors.username = 'Kullanıcı adınızı girin.'
    if (!password) errors.password = 'Parolanızı girin.'
    setFields(errors)
    if (errors.username || errors.password) {
      ;(errors.username ? usernameRef : passwordRef).current?.focus()
      return
    }
    if (!(await signIn(username, password))) passwordRef.current?.focus()
  }

  return (
    <AuthScreen title="Giriş yapın">
      <p className="auth-description">Çalışma alanınıza erişmek için giriş yapın.</p>
      {notice && <p className="auth-description" role="status">{notice}</p>}
      <form className="login-form" onSubmit={submit} noValidate aria-busy={busy}>
        <Input ref={usernameRef} id="login-username" name="username" label="Kullanıcı adı" required
          autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={128}
          value={username} disabled={busy} error={fields.username}
          onChange={event => { setUsername(event.target.value); setFields(current => ({ ...current, username: undefined })) }} />
        <Input ref={passwordRef} id="login-password" name="password" label="Parola" required
          type={visible ? 'text' : 'password'} autoComplete="current-password" maxLength={128}
          value={password} disabled={busy} error={fields.password}
          onChange={event => { setPassword(event.target.value); setFields(current => ({ ...current, password: undefined })) }}
          endAdornment={<Button variant="ghost" className="password-toggle" aria-controls="login-password"
            aria-label={visible ? 'Parolayı gizle' : 'Parolayı göster'} aria-pressed={visible} disabled={busy}
            onClick={() => setVisible(current => !current)}>{visible ? 'Gizle' : 'Göster'}</Button>} />
        {error && <ErrorState title="Giriş yapılamadı" description={error} />}
        <Button type="submit" className="login-submit" loading={busy} loadingText="Giriş yapılıyor…">Giriş Yap</Button>
      </form>
    </AuthScreen>
  )
}
