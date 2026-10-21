import { useCallback, useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { Brand, Loading, Notice } from './components'
import { api, ApiError, UNAUTHORIZED_EVENT, type Me } from './lib/api'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { PatientApp } from './pages/PatientApp'
import { ProfileForm } from './pages/ProfileForm'
import { ConsentPage } from './pages/ConsentPage'

type Session = { status: 'loading' } | { status: 'anon' } | { status: 'error'; message: string } | { status: 'ready'; me: Me }

export default function App() {
  const [session, setSession] = useState<Session>({ status: 'loading' })

  const refresh = useCallback(() => {
    api.me()
      .then((me) => setSession({ status: 'ready', me }))
      .catch((e) => setSession(e instanceof ApiError && e.status === 401 ? { status: 'anon' } : { status: 'error', message: e.message }))
  }, [])

  useEffect(() => {
    refresh()
    const onUnauthorized = () => setSession({ status: 'anon' })
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [refresh])

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setSession({ status: 'anon' })
    window.scrollTo(0, 0)
  }

  if (session.status === 'loading') return <div className="login-shell"><Loading /></div>
  if (session.status === 'error') return <div className="login-shell"><div className="login-card"><Brand /><Notice kind="error">{session.message}</Notice><button className="primary-button" onClick={refresh}>Coba lagi</button></div></div>
  if (session.status === 'anon') return <LoginPage onLoggedIn={refresh} />

  const { me } = session
  if (me.role === 'researcher') return <AdminPage me={me} onLogout={logout} />
  // Onboarding: 1) persetujuan -> 2) data diri awal -> 3) profil lanjutan.
  if (!me.consentGiven || !me.onboardingComplete) {
    return (
      <div className="patient-shell log-shell">
        <header className="patient-header">
          <Brand compact />
          <div className="header-actions"><span className="avatar">{me.code}</span><button className="icon-button" aria-label="Keluar" onClick={logout}><LogOut size={18} /></button></div>
        </header>
        {!me.consentGiven ? <ConsentPage onDone={refresh} /> : <ProfileForm onboarding onSaved={refresh} />}
      </div>
    )
  }
  return <PatientApp me={me} onLogout={logout} />
}
