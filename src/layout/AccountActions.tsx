import { Button } from '../components/ui'
import type { User } from '../services/auth'

export function AccountActions({ user, busy, onSignOut, onNavigate }: { user: User; busy: boolean; onSignOut: () => void; onNavigate?: () => void }) {
  return (
    <div className="account-actions">
      <div className="account-details"><strong>{user.username}</strong><span>{user.role === 'admin' ? 'Yönetici' : 'Çalışan'}</span></div>
      <a className="ui-button ui-button--ghost" href="#/hesabim" onClick={onNavigate}>Hesabım</a>
      <Button variant="ghost" onClick={onSignOut} loading={busy} loadingText="Çıkış yapılıyor…">Çıkış Yap</Button>
    </div>
  )
}
