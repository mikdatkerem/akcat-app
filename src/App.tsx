import { AppLayout } from './layout/AppLayout'
import { usePage } from './layout/navigation'
import { OverviewPage } from './pages/OverviewPage'
import { ModulePage } from './pages/ModulePage'
import { MenuPage } from './pages/MenuPage'
import { modulePages } from './pages/modulePages'
import { PageHeader } from './pages/PageHeader'
import { ErrorState, LoadingState } from './components/ui'
import { useSession } from './auth/useSession'
import { checkSession, signOut } from './auth/sessionStore'
import { LoginPage } from './auth/LoginPage'
import { AuthScreen } from './auth/AuthScreen'
import { canAccessPage } from './layout/navigation'
import './App.css'

function App() {
  const page = usePage()
  const auth = useSession()
  const title = page === 'overview' ? 'Genel Bakış' : page === 'menu' ? 'Menü' : page === 'not-found' ? 'Sayfa bulunamadı' : modulePages[page].title

  if (auth.status === 'checking') return <AuthScreen title="Oturum kontrol ediliyor"><LoadingState label="Lütfen bekleyin…" /></AuthScreen>
  if (auth.status === 'unavailable') return <AuthScreen title="Oturum kontrol edilemedi">
    <div className="auth-description"><ErrorState title="Bağlantı doğrulanamadı"
      description={auth.error ?? 'Lütfen tekrar deneyin.'} onRetry={() => { void checkSession() }} /></div>
  </AuthScreen>
  if (auth.status !== 'authenticated' || !auth.session) return <LoginPage busy={auth.busy === 'login'} error={auth.error} />
  const user = auth.session.user

  return (
    <AppLayout page={page} title={title} user={user} signingOut={auth.busy === 'logout'} onSignOut={() => { void signOut() }}>
      {auth.error && <div className="session-notice"><ErrorState title="Çıkış tamamlanamadı" description={auth.error}
        onRetry={() => { void checkSession() }} /></div>}
      {!canAccessPage(page, user.role) ? <>
        <PageHeader title="Erişim izni gerekli" description="Bu çalışma alanına erişim yetkiniz bulunmuyor." />
        <a className="text-link" href="#/genel-bakis">Genel Bakış’a dön</a>
      </> : page === 'overview' ? <OverviewPage role={user.role} /> : page === 'menu' ? <MenuPage role={user.role} /> : page === 'not-found' ? <>
        <PageHeader title={title} description="Bu adres için bir çalışma alanı bulunamadı." />
        <ErrorState title="Sayfa bulunamadı" description="Menüden bir çalışma alanı seçerek devam edebilirsiniz." />
        <a className="text-link" href="#/genel-bakis">Genel Bakış’a dön</a>
      </> : <ModulePage page={page} />}
    </AppLayout>
  )
}

export default App
