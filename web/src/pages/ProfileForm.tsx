import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, Gauge, UserRound } from 'lucide-react'
import { Field, Loading, Notice, OnboardingSteps, Select, ToggleQuestion } from '../components'
import {
  adherenceOptions, alcoholOptions, artStatusOptions, cd4Options, educationOptions, incomeOptions,
  maritalOptions, sexOptions, smokingOptions, viralLoadOptions,
} from '../data'
import { api, ApiError, type Profile } from '../lib/api'

type Draft = {
  [K in keyof Profile]: Profile[K] extends number | null ? string
    : Profile[K] extends boolean ? boolean | undefined
    : NonNullable<Profile[K]> | ''
}

const emptyDraft: Draft = {
  age: '', sex: '', weightKg: '', heightCm: '', education: '', maritalStatus: '', occupation: '', incomeGroup: '',
  diagnosisDurationMonths: '', artStatus: '', artDurationMonths: '', artRegimen: '', adherence: '', cd4Category: '',
  viralLoadCategory: '', smoking: '', alcohol: '', hasComplications: undefined, complications: '',
  hasTreatmentSideEffects: undefined, treatmentSideEffects: '',
}

const fromProfile = (p: Profile): Draft => ({
  ...emptyDraft,
  ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? '' : typeof v === 'number' ? String(v) : v])),
  // Lama diagnosis ditampilkan dalam tahun agar mudah diisi pasien.
  diagnosisDurationMonths: String(Math.round((p.diagnosisDurationMonths / 12) * 10) / 10),
} as Draft)

const optNum = (v: string) => (v.trim() === '' ? null : Number(v))
const optText = <T extends string>(v: T | '') => (v === '' ? null : v)

const DEMOGRAPHIC_FIELDS: Array<[keyof Draft, string]> = [
    ['age', 'usia'], ['sex', 'jenis kelamin'], ['heightCm', 'tinggi badan'], ['weightKg', 'berat badan'],
    ['education', 'pendidikan'], ['maritalStatus', 'status pernikahan'], ['occupation', 'pekerjaan'],
    ['incomeGroup', 'pendapatan'],
]

const missingLabels = (d: Draft, fields: Array<[keyof Draft, string]>) =>
  fields.filter(([k]) => String(d[k] ?? '').trim() === '').map(([, label]) => label)

/** Validasi langkah "Data diri awal". */
function checkDemographics(d: Draft): string | null {
  const missing = missingLabels(d, DEMOGRAPHIC_FIELDS)
  return missing.length ? `Lengkapi: ${missing.join(', ')}.` : null
}

function toProfile(d: Draft): Profile | string {
  const missing = missingLabels(d, [...DEMOGRAPHIC_FIELDS, ['diagnosisDurationMonths', 'lama sejak diagnosis']])
  if (missing.length) return `Lengkapi: ${missing.join(', ')}.`
  if (d.hasComplications === undefined) return 'Jawab pertanyaan tentang komplikasi.'
  if (d.hasTreatmentSideEffects === undefined) return 'Jawab pertanyaan tentang efek samping pengobatan.'
  if (d.hasComplications && !d.complications.trim()) return 'Tuliskan komplikasi yang dimiliki.'
  if (d.hasTreatmentSideEffects && !d.treatmentSideEffects.trim()) return 'Tuliskan efek samping pengobatan.'
  return {
    age: Number(d.age),
    sex: d.sex as Profile['sex'],
    weightKg: Number(d.weightKg),
    heightCm: Number(d.heightCm),
    education: d.education,
    maritalStatus: d.maritalStatus as Profile['maritalStatus'],
    occupation: d.occupation.trim(),
    incomeGroup: d.incomeGroup as Profile['incomeGroup'],
    diagnosisDurationMonths: Math.round(Number(d.diagnosisDurationMonths) * 12),
    artStatus: optText(d.artStatus),
    artDurationMonths: optNum(d.artDurationMonths),
    artRegimen: d.artRegimen.trim() || null,
    adherence: optText(d.adherence),
    cd4Category: optText(d.cd4Category),
    viralLoadCategory: optText(d.viralLoadCategory),
    smoking: optText(d.smoking),
    alcohol: optText(d.alcohol),
    hasComplications: d.hasComplications,
    complications: d.hasComplications ? d.complications.trim() : null,
    hasTreatmentSideEffects: d.hasTreatmentSideEffects,
    treatmentSideEffects: d.hasTreatmentSideEffects ? d.treatmentSideEffects.trim() : null,
  }
}

export function ProfileForm({ onboarding = false, onSaved, onCancel }: { onboarding?: boolean; onSaved: () => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(onboarding ? emptyDraft : null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  // Onboarding dibagi dua langkah; saat mengedit profil semua bagian tampil sekaligus.
  const [step, setStep] = useState<'basic' | 'health'>('basic')

  useEffect(() => {
    if (onboarding) return
    api.getProfile().then((p) => setDraft(p ? fromProfile(p) : emptyDraft)).catch((e) => { setDraft(emptyDraft); setError(e.message) })
  }, [onboarding])

  const bmi = useMemo(() => {
    const h = Number(draft?.heightCm) / 100
    const w = Number(draft?.weightKg)
    return h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : null
  }, [draft?.heightCm, draft?.weightKg])

  if (!draft) return <Loading label="Memuat profil…" />
  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setSaved(false) }

  const showBasic = !onboarding || step === 'basic'
  const showHealth = !onboarding || step === 'health'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (onboarding && step === 'basic') {
      const problem = checkDemographics(draft)
      if (problem) { setError(problem); return }
      setError(''); setStep('health'); window.scrollTo(0, 0)
      return
    }
    const profile = toProfile(draft)
    if (typeof profile === 'string') { setError(profile); return }
    setError(''); setBusy(true)
    try {
      await api.saveProfile(profile)
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan profil.')
    } finally { setBusy(false) }
  }

  return (
    <form className="form-page" onSubmit={submit} noValidate>
      {onboarding && <OnboardingSteps current={step === 'basic' ? 2 : 3} />}
      <section className="form-card intro-card">
        <span className="form-card-icon green"><UserRound size={22} /></span>
        <div>
          <p className="step-label">{!onboarding ? 'DATA DEMOGRAFI' : step === 'basic' ? 'LANGKAH 2 DARI 3' : 'LANGKAH 3 DARI 3'}</p>
          <h2>{!onboarding ? 'Profil kesehatanmu' : step === 'basic' ? 'Data diri awal' : 'Profil kesehatan lanjutan'}</h2>
          <p>{!onboarding ? 'Perbarui bila ada perubahan.' : step === 'basic' ? 'Data dasar tentang dirimu. Cukup diisi sekali di awal.' : 'Sedikit lagi. Setelah ini kamu bisa mulai mencatat harian.'}</p>
        </div>
      </section>
      {showBasic && <section className="form-card profile-grid">
        <Field label="Usia"><div className="number-input"><input type="number" inputMode="numeric" min="10" max="120" value={draft.age} onChange={(e) => set({ age: e.target.value })} required /><span>tahun</span></div></Field>
        <Field label="Jenis kelamin"><Select required value={draft.sex} options={sexOptions} onChange={(sex) => set({ sex })} /></Field>
        <Field label="Tinggi badan"><div className="number-input"><input type="number" inputMode="decimal" min="80" max="250" value={draft.heightCm} onChange={(e) => set({ heightCm: e.target.value })} required /><span>cm</span></div></Field>
        <Field label="Berat badan"><div className="number-input"><input type="number" inputMode="decimal" min="20" max="500" step="0.1" value={draft.weightKg} onChange={(e) => set({ weightKg: e.target.value })} required /><span>kg</span></div></Field>
        <div className="bmi-panel" aria-live="polite"><span><Gauge size={20} /> BMI (dihitung otomatis)</span><strong>{bmi ?? '–'}</strong><small>Berat (kg) ÷ tinggi (m)²</small></div>
        <Field label="Pendidikan terakhir"><Select required value={draft.education} options={educationOptions} onChange={(education) => set({ education })} /></Field>
        <Field label="Status pernikahan"><Select required value={draft.maritalStatus} options={maritalOptions} onChange={(maritalStatus) => set({ maritalStatus })} /></Field>
        <Field label="Pekerjaan"><input value={draft.occupation} maxLength={150} onChange={(e) => set({ occupation: e.target.value })} placeholder="Contoh: wiraswasta" required /></Field>
        <Field label="Pendapatan per bulan"><Select required value={draft.incomeGroup} options={incomeOptions} onChange={(incomeGroup) => set({ incomeGroup })} /></Field>
      </section>}
      {showHealth && <>
      <section className="form-card field-stack">
        <Field label="Lama sejak diagnosis"><div className="number-input"><input type="number" inputMode="decimal" min="0" max="120" step="0.5" value={draft.diagnosisDurationMonths} onChange={(e) => set({ diagnosisDurationMonths: e.target.value })} required /><span>tahun</span></div></Field>
        <ToggleQuestion label="Apakah kamu memiliki komplikasi?" value={draft.hasComplications} onChange={(hasComplications) => set({ hasComplications, complications: hasComplications ? draft.complications : '' })} />
        {draft.hasComplications && <Field label="Tuliskan komplikasi yang dimiliki"><textarea rows={3} maxLength={1000} value={draft.complications} onChange={(e) => set({ complications: e.target.value })} /></Field>}
        <ToggleQuestion label="Apakah ada efek samping pengobatan?" value={draft.hasTreatmentSideEffects} onChange={(hasTreatmentSideEffects) => set({ hasTreatmentSideEffects, treatmentSideEffects: hasTreatmentSideEffects ? draft.treatmentSideEffects : '' })} />
        {draft.hasTreatmentSideEffects && <Field label="Tuliskan efek samping yang dirasakan"><textarea rows={3} maxLength={1000} value={draft.treatmentSideEffects} onChange={(e) => set({ treatmentSideEffects: e.target.value })} /></Field>}
      </section>
      <section className="form-card field-stack optional-clinical">
        <div><p className="step-label">OPSIONAL</p><h3>Informasi tambahan</h3><p>Isi hanya bila kamu mengetahuinya. Boleh dikosongkan.</p></div>
        <div className="field-pair">
          <Field label="Status terapi"><Select value={draft.artStatus} options={artStatusOptions} placeholder="Tidak diisi" onChange={(artStatus) => set({ artStatus })} /></Field>
          <Field label="Lama menjalani terapi"><div className="number-input"><input type="number" inputMode="numeric" min="0" max="1440" value={draft.artDurationMonths} onChange={(e) => set({ artDurationMonths: e.target.value })} /><span>bulan</span></div></Field>
        </div>
        <div className="field-pair">
          <Field label="Nama/jenis obat terapi"><input value={draft.artRegimen} maxLength={150} onChange={(e) => set({ artRegimen: e.target.value })} /></Field>
          <Field label="Kepatuhan minum obat"><Select value={draft.adherence} options={adherenceOptions} placeholder="Tidak diisi" onChange={(adherence) => set({ adherence })} /></Field>
        </div>
        <div className="field-pair">
          <Field label="Kategori CD4 terakhir"><Select value={draft.cd4Category} options={cd4Options} placeholder="Tidak diisi" onChange={(cd4Category) => set({ cd4Category })} /></Field>
          <Field label="Viral load terakhir"><Select value={draft.viralLoadCategory} options={viralLoadOptions} placeholder="Tidak diisi" onChange={(viralLoadCategory) => set({ viralLoadCategory })} /></Field>
        </div>
        <div className="field-pair">
          <Field label="Merokok"><Select value={draft.smoking} options={smokingOptions} placeholder="Tidak diisi" onChange={(smoking) => set({ smoking })} /></Field>
          <Field label="Konsumsi alkohol"><Select value={draft.alcohol} options={alcoholOptions} placeholder="Tidak diisi" onChange={(alcohol) => set({ alcohol })} /></Field>
        </div>
      </section>
      </>}
      {error && <Notice kind="error">{error}</Notice>}
      {saved && !onboarding && <Notice kind="success">Profil tersimpan.</Notice>}
      <div className="save-bar">
        {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>Kembali</button>}
        {onboarding && step === 'health' && <button type="button" className="secondary-button" onClick={() => { setError(''); setStep('basic'); window.scrollTo(0, 0) }}>Kembali</button>}
        <button className="primary-button" type="submit" disabled={busy}>
          {onboarding && step === 'basic' ? <>Lanjut <ChevronRight size={18} /></> : <><ClipboardCheck size={18} /> {busy ? 'Menyimpan…' : onboarding ? 'Simpan & mulai' : 'Simpan profil'}</>}
        </button>
      </div>
    </form>
  )
}
