import { Button } from '../components/ui'
import type { User } from '../services/auth'

export function AccountActions({ user, busy, onSignOut }: { user: User; busy: boolean; onSignOut: () => void }) {
  return (
    <div className="account-actions">
      <div className="account-details"><strong>{user.username}</strong><span>{user.role === 'admin' ? 'Yönetici' : 'Çalışan'}</span></div>
      <Button variant="ghost" onClick={onSignOut} loading={busy} loadingText="Çıkış yapılıyor…">Çıkış Yap</Button>
    </div>
  )
}
