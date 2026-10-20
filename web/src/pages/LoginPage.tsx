import { FormEvent, useState } from 'react'
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { Brand, Field, Notice } from '../components'
import { api, ApiError } from '../lib/api'

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setBusy(true)
    try {
      await api.login(code.trim(), pin)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk. Coba lagi.')
      setPin('')
    } finally { setBusy(false) }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <div className="login-intro">
          <span className="form-card-icon green"><KeyRound size={22} /></span>
          <div><h1>Masuk</h1><p>Gunakan kode dan PIN yang diberikan oleh tim peneliti.</p></div>
        </div>
        <Field label="Kode partisipan">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Contoh: P001" autoComplete="username" autoCapitalize="characters" required maxLength={50} />
        </Field>
        <Field label="PIN" hint="6–12 angka">
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} type="password" inputMode="numeric" autoComplete="current-password" pattern="\d{6,12}" minLength={6} maxLength={12} required />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button className="primary-button" type="submit" disabled={busy}><LogIn size={18} /> {busy ? 'Memproses…' : 'Masuk'}</button>
        <p className="privacy-note"><ShieldCheck size={16} /> Jika memakai HP bersama, tekan Keluar setelah selesai.</p>
      </form>
    </div>
  )
}
