import { useEffect, type ReactNode } from 'react'
import logoUrl from '../assets/akcat-logo.png'
import './auth.css'

export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = title + ' · AKÇAT' }, [title])
  return (
    <main className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-container">
        <div className="auth-brand"><img className="brand-logo" src={logoUrl} alt="AKÇAT" width="2172" height="724" /></div>
        <section className="auth-panel">
          <h1 id="auth-title">{title}</h1>
          {children}
        </section>
        <p className="auth-footer">Su dağıtım ve operasyon yönetimi</p>
      </div>
    </main>
  )
}
