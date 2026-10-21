import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Leaf } from 'lucide-react'
import { moodOptions, type ScaleOption } from './data'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark"><Leaf size={compact ? 17 : 20} strokeWidth={2.5} /></span>
      <span>Mood<span>Bite</span></span>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function ToggleQuestion({ label, value, onChange, noLabel = 'Tidak', yesLabel = 'Ya' }: { label: string; value?: boolean | undefined; onChange: (v: boolean) => void; noLabel?: string; yesLabel?: string }) {
  return (
    <fieldset className="toggle-question">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        <button type="button" role="radio" aria-checked={value === false} className={value === false ? 'selected' : ''} onClick={() => onChange(false)}>{noLabel}</button>
        <button type="button" role="radio" aria-checked={value === true} className={value === true ? 'selected' : ''} onClick={() => onChange(true)}>{yesLabel}</button>
      </div>
    </fieldset>
  )
}

export function ScalePicker({ options, value, onChange, label }: { options: ScaleOption[]; value?: number | null | undefined; onChange: (value: number) => void; label: string }) {
  return (
    <div className="scale-picker" role="radiogroup" aria-label={label}>
      {options.map((item) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === item.value}
          aria-label={`${item.value} – ${item.label}`}
          className={value === item.value ? 'selected' : ''}
          style={{ '--mood': item.color } as React.CSSProperties}
          key={item.value}
          onClick={() => onChange(item.value)}
        >
          <span aria-hidden>{item.face}</span><b>{item.value}</b><small>{item.label.replace(' ', '\n')}</small>
        </button>
      ))}
    </div>
  )
}

/** Wajah garis berwarna seperti gambar referensi (0 senang ... 5 marah sekali). */
export function EmotionFace({ level, color, size = 38 }: { level: number; color: string; size?: number }) {
  const mouth = ['M12 23 Q20 33 28 23 Z', 'M13 24 Q20 30 27 24', 'M13 26 L27 26', 'M13 29 Q20 23 27 29', 'M13 29 Q20 24 27 29', 'M12 30 Q20 21 28 30'][level]
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="17.5" fill="white" stroke={color} strokeWidth="2.6" />
      <circle cx="14.5" cy="16.5" r="2" fill={color} /><circle cx="25.5" cy="16.5" r="2" fill={color} />
      {level >= 4 && <path d={level === 5 ? 'M10 10.5 L18 14 M30 10.5 L22 14' : 'M11 11.5 L17 13.5 M29 11.5 L23 13.5'} stroke={color} strokeWidth="2.4" strokeLinecap="round" />}
      {level === 3 && <path d="M11 12.5 L17 11 M29 12.5 L23 11" stroke={color} strokeWidth="2" strokeLinecap="round" />}
      <path d={mouth} stroke={color} strokeWidth="2.4" strokeLinecap="round" fill={level === 0 ? color : 'none'} />
    </svg>
  )
}

/**
 * Termometer emosi 0-5, meniru gambar referensi klien: wajah -> tabung bernomor -> label & deskripsi.
 * Seluruh baris dapat diketuk; angka, wajah, dan label selalu tampil (warna bukan satu-satunya penanda).
 */
export function MoodThermometer({ value, onChange }: { value?: number | undefined; onChange: (value: number) => void }) {
  const levels = [...moodOptions].reverse()
  const selected = moodOptions.find((o) => o.value === value)
  return (
    <div className="emo">
      <h3 className="emo-title">Bagaimana perasaanmu saat ini?</h3>
      <div className="emo-scale" role="radiogroup" aria-label="Termometer emosi, 0 senang sampai 5 marah sekali">
        {levels.map((o) => (
          <button
            type="button"
            role="radio"
            key={o.value}
            aria-checked={value === o.value}
            aria-label={`${o.value} – ${o.label}. ${o.description}`}
            className={`emo-row level-${o.value}${value === o.value ? ' selected' : ''}`}
            style={{ '--c': o.color } as React.CSSProperties}
            onClick={() => onChange(o.value)}
          >
            <span className="emo-face"><EmotionFace level={o.value} color={o.color} /></span>
            <span className="emo-arrow to-left" aria-hidden />
            <span className="emo-band" aria-hidden><b>{o.value}</b></span>
            <span className="emo-arrow" aria-hidden />
            <span className="emo-text"><strong>{o.label}</strong><small>{o.description}</small></span>
          </button>
        ))}
      </div>
      {selected && selected.value >= 4 && (
        <p className="emo-support" role="status">
          Terima kasih sudah jujur dengan perasaanmu. Kalau kamu butuh bantuan sekarang, hubungi tim peneliti atau orang yang kamu percaya.
          Dalam keadaan darurat, hubungi <strong>119</strong>.
        </p>
      )}
    </div>
  )
}

/** Select dengan pilihan kosong "Pilih…" agar tidak ada nilai bawaan yang terkirim tanpa sengaja. */
export function Select<T extends string>({ value, onChange, options, placeholder = 'Pilih…', required }: {
  value: NoInfer<T> | '' | null | undefined
  onChange: (value: T | '') => void
  options: Array<{ value: T; label: string }> | string[]
  placeholder?: string
  required?: boolean
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o as T, label: o } : o))
  return (
    <select value={value ?? ''} required={required} onChange={(e) => onChange(e.target.value as T | '')}>
      <option value="" disabled={required}>{placeholder}</option>
      {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  )
}

const ONBOARDING_STEPS = ['Persetujuan', 'Data diri awal', 'Profil lanjutan']

/** Penunjuk langkah onboarding: Persetujuan -> Data diri awal -> Profil lanjutan. */
export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="onboarding-steps" aria-label={`Langkah ${current} dari ${ONBOARDING_STEPS.length}`}>
      {ONBOARDING_STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'current' : 'todo'
        return <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}><b>{state === 'done' ? '✓' : n}</b><span>{label}</span></li>
      })}
    </ol>
  )
}

export function Notice({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return (
    <p className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}<span>{children}</span>
    </p>
  )
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden />{label}</div>
}
