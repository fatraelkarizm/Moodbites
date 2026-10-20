import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, BedDouble, CalendarDays, Check, ChevronRight, ClipboardCheck, HeartPulse, Home, LogOut, MoonStar,
  Lightbulb, MessageSquareHeart, Pencil, Plus, ShieldCheck, Sparkles, UserRound, Utensils, Zap,
} from 'lucide-react'
import { Brand, EmotionFace, Field, Loading, MoodThermometer, Notice, ScalePicker, Select, ToggleQuestion } from '../components'
import { barrierOptions, easeOptions, foodCategories, labelOf, mealTypes, mindfulnessOptions, moodOptions, portionOptions, sleepOptions } from '../data'
import { api, ApiError, type DayData, type FoodCategory, type History, type Meal, type MealType, type Me, type PersonalInsights, type Barrier, type FeedbackStatus } from '../lib/api'
import { LinkedTimeline } from '../insights'
import { personalSentence } from '../lib/insights'
import { formatLongDate, formatShortDate, greeting, jakartaToday, shiftDate } from '../lib/date'
import { ProfileForm } from './ProfileForm'

type View = 'today' | 'log' | 'history' | 'feedback'
type LogTab = 'mood' | 'meal' | 'sleep' | 'profile'

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')

function useDay(date: string) {
  const [day, setDay] = useState<DayData | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    setError('')
    return api.getDay(date).then(setDay).catch((e) => setError(errorText(e)))
  }, [date])
  useEffect(() => { setDay(null); reload() }, [reload])
  return { day, error, reload }
}

function PatientHeader({ me, onLogout }: { me: Me; onLogout: () => void }) {
  return (
    <header className="patient-header">
      <Brand compact />
      <div className="header-actions">
        <span className="avatar" title="Kode partisipan">{me.code}</span>
        <button className="icon-button" aria-label="Keluar" title="Keluar" onClick={onLogout}><LogOut size={18} /></button>
      </div>
    </header>
  )
}

function BottomNav({ active, onChange }: { active: View | 'profile'; onChange: (view: View, tab?: LogTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button className={active === 'today' ? 'active' : ''} aria-current={active === 'today' ? 'page' : undefined} onClick={() => onChange('today')}><Home size={20} /><span>Hari ini</span></button>
      <button className={active === 'log' ? 'active center-nav' : 'center-nav'} onClick={() => onChange('log', 'mood')}><span className="plus-bubble"><Plus size={22} /></span><span>Catat</span></button>
      <button className={active === 'history' ? 'active' : ''} aria-current={active === 'history' ? 'page' : undefined} onClick={() => onChange('history')}><CalendarDays size={20} /><span>Riwayat</span></button>
      <button className={active === 'profile' ? 'active' : ''} onClick={() => onChange('log', 'profile')}><UserRound size={20} /><span>Profil</span></button>
    </nav>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  return (
    <div className="progress-ring" style={{ '--progress': `${(done / total) * 100}%` } as React.CSSProperties} role="img" aria-label={`${done} dari ${total} catatan selesai`}>
      <div><strong>{done}<small>/{total}</small></strong><span>selesai</span></div>
    </div>
  )
}

function TodayPage({ me, navigate, onLogout }: { me: Me; navigate: (view: View, tab?: LogTab) => void; onLogout: () => void }) {
  const today = jakartaToday()
  const { day, error } = useDay(today)
  const mood = day?.mood
  const currentMood = moodOptions.find((o) => o.value === mood?.mood)
  const done = day ? [day.meals.length > 0, !!day.mood, !!day.sleep].filter(Boolean).length : 0
  const [feedback, setFeedback] = useState<FeedbackStatus | null>(null)
  useEffect(() => { api.feedbackStatus().then(setFeedback).catch(() => setFeedback(null)) }, [])

  return (
    <div className="patient-shell">
      <PatientHeader me={me} onLogout={onLogout} />
      <main className="patient-main">
        <section className="hello-row">
          <div>
            <p className="eyebrow">{formatLongDate(today)}</p>
            <h1>{greeting()} <span aria-hidden>👋</span></h1>
            <p>Satu catatan kecil hari ini berarti banyak.</p>
          </div>
          <ProgressRing done={done} total={3} />
        </section>

        {error && <Notice kind="error">{error}</Notice>}
        {feedback?.eligible && !feedback.feedback && (
          <section className="gentle-card daily-prompt feedback-prompt">
            <div className="prompt-icon"><MessageSquareHeart size={20} /></div>
            <div><span>Langkah terakhir studi</span><p>Ceritakan pengalamanmu memakai MoodBite. Hanya sekitar 1 menit.</p></div>
            <button onClick={() => navigate('feedback')} aria-label="Isi kuesioner pengalaman"><ChevronRight size={21} /></button>
          </section>
        )}
        {!day && !error ? <Loading /> : day && (
          <>
            {done < 3 && (
              <section className="gentle-card daily-prompt">
                <div className="prompt-icon"><Sparkles size={20} /></div>
                <div><span>Pengingat</span><p>Luangkan 2 menit untuk mencatat makan, perasaan, dan tidurmu hari ini.</p></div>
                <button onClick={() => navigate('log', !day.mood ? 'mood' : !day.meals.length ? 'meal' : 'sleep')} aria-label="Mulai pencatatan"><ChevronRight size={21} /></button>
              </section>
            )}

            <div className="section-heading">
              <div><h2>Ringkasan hari ini</h2><p>Ketuk untuk mengisi atau memperbaiki</p></div>
              <span>{done} dari 3 terisi</span>
            </div>

            <section className="summary-grid">
              <button className="metric-card mood-card" onClick={() => navigate('log', 'mood')}>
                <span className="metric-icon"><HeartPulse size={20} /></span>
                <span className="metric-label">Suasana hati</span>
                {currentMood ? <><strong className="mood-strong"><EmotionFace level={currentMood.value} color={currentMood.color} size={22} /> {currentMood.label}</strong><small>Termometer emosi: {currentMood.value} (0–5)</small></> : <><strong>Belum dicatat</strong><small>Bagaimana perasaanmu?</small></>}
                <span className="card-action">{currentMood ? 'Ubah' : 'Catat'} <ChevronRight size={16} /></span>
              </button>
              <button className="metric-card sleep-card" onClick={() => navigate('log', 'sleep')}>
                <span className="metric-icon"><MoonStar size={20} /></span>
                <span className="metric-label">Tidur semalam</span>
                {day.sleep ? <><strong>{day.sleep.durationHours} <em>jam</em></strong><small>Kualitas {day.sleep.quality}/5 · {sleepOptions.find((o) => o.value === day.sleep?.quality)?.label}</small></> : <><strong>Belum dicatat</strong><small>Ceritakan tidurmu</small></>}
                <span className="card-action">{day.sleep ? 'Ubah' : 'Catat'} <ChevronRight size={16} /></span>
              </button>
            </section>

            <section className="meal-section">
              <div className="section-heading compact">
                <div><h2>Makan hari ini</h2><p>{day.meals.length ? `${day.meals.length} catatan tersimpan` : 'Belum ada catatan makan'}</p></div>
                <button className="text-button" onClick={() => navigate('log', 'meal')}><Plus size={17} /> Tambah</button>
              </div>
              {day.meals.length ? (
                <div className="meal-list">
                  {day.meals.map((meal) => (
                    <button key={meal.id} className="meal-row" onClick={() => navigate('log', 'meal')}>
                      <span className="meal-dot"><Utensils size={17} /></span>
                      <span><strong>{labelOf(mealTypes, meal.mealType)}</strong><small>{meal.foodName} · {labelOf(foodCategories, meal.foodCategory)}</small></span>
                      <time>{meal.eatenAt}</time><ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <button className="empty-meal" onClick={() => navigate('log', 'meal')}>
                  <span><Utensils size={22} /></span>
                  <span><strong>Catat makanan pertamamu</strong><small>Tanpa hitung kalori, cukup yang kamu ingat.</small></span>
                  <ChevronRight size={18} />
                </button>
              )}
              {day.mealsComplete === true && <p className="meal-status done"><Check size={14} /> Semua makan hari ini sudah ditandai lengkap</p>}
              {day.mealsComplete !== true && day.meals.length > 0 && (
                <button className="meal-status" onClick={() => navigate('log', 'meal')}>Sudah semua? Tandai makan hari ini lengkap <ChevronRight size={14} /></button>
              )}
            </section>

            <section className="stress-strip">
              <span className="stress-icon"><Zap size={19} /></span>
              <span><strong>Stres saat ini</strong><small>{!mood ? 'Belum dijawab' : mood.isStressed ? `Ya · ${mood.stressCause}` : 'Tidak merasa stres'}</small></span>
              <button onClick={() => navigate('log', 'mood')}>{mood ? 'Ubah' : 'Jawab'}</button>
            </section>
          </>
        )}
        <p className="privacy-note"><ShieldCheck size={16} /> Catatanmu bersifat pribadi. Tekan Keluar bila HP dipakai bersama.</p>
      </main>
      <BottomNav active="today" onChange={navigate} />
    </div>
  )
}

/* ---------- Form catatan ---------- */

function SaveBar({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="save-bar">
      <button type="button" className="secondary-button" onClick={onCancel}>Kembali</button>
      <button className="primary-button" type="submit" disabled={busy}><ClipboardCheck size={18} /> {busy ? 'Menyimpan…' : label}</button>
    </div>
  )
}

/**
 * Mengirim formulir dan mengukur waktu aktif mengisi (PRD bagian 11): dari interaksi pertama sampai berhasil disimpan.
 * Aplikasi yang dibiarkan terbuka tanpa disentuh tidak ikut terhitung.
 */
function useSubmit(action: (fillSeconds: number) => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const startedAt = useRef<number | null>(null)
  const touch = () => { if (startedAt.current === null) startedAt.current = Date.now() }
  const run = async (event: FormEvent, successText: string) => {
    event.preventDefault()
    setError(''); setSuccess(''); setBusy(true)
    const fillSeconds = startedAt.current === null ? 0 : Math.min(3600, Math.round((Date.now() - startedAt.current) / 1000))
    try {
      await action(fillSeconds)
      startedAt.current = null
      setSuccess(successText)
    } catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  return { busy, error, success, setError, setSuccess, run, track: { onPointerDownCapture: touch, onKeyDownCapture: touch, onInputCapture: touch } }
}

function MoodForm({ date, day, onSaved, onCancel }: { date: string; day: DayData; onSaved: () => Promise<unknown>; onCancel: () => void }) {
  const [mood, setMood] = useState(day.mood?.mood)
  const [note, setNote] = useState(day.mood?.note ?? '')
  const [isStressed, setIsStressed] = useState(day.mood?.isStressed)
  const [cause, setCause] = useState(day.mood?.stressCause ?? '')
  const submit = useSubmit(async (fillSeconds) => {
    if (mood === undefined) throw new ApiError(400, 'Pilih posisimu di termometer emosi.')
    if (isStressed === undefined) throw new ApiError(400, 'Jawab apakah kamu merasa stres saat ini.')
    if (isStressed && !cause.trim()) throw new ApiError(400, 'Tuliskan penyebab stresmu.')
    await api.saveMood({ entryDate: date, mood, note: note.trim() || null, isStressed, stressCause: isStressed ? cause.trim() : null, fillSeconds })
    await onSaved()
  })
  return (
    <form className="form-page" {...submit.track} onSubmit={(e) => submit.run(e, 'Perasaan & stres tersimpan.')} noValidate>
      <section className="form-card intro-card">
        <span className="form-card-icon coral"><HeartPulse size={22} /></span>
        <div><p className="step-label">PERASAAN & STRES</p><h2>Bagaimana perasaanmu?</h2><p>Tidak ada jawaban benar atau salah. Pilih yang paling mendekati.</p></div>
      </section>
      <section className="form-card">
        <MoodThermometer value={mood} onChange={setMood} />
        <Field label="Secara umum, bagaimana perasaanmu hari ini?" hint="Opsional · maks. 300 karakter">
          <textarea maxLength={300} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: hari ini saya merasa lebih berenergi…" />
        </Field>
      </section>
      <section className="form-card field-stack">
        <ToggleQuestion label="Apakah kamu merasa stres saat ini?" value={isStressed} onChange={(v) => { setIsStressed(v); if (!v) setCause('') }} />
        {isStressed && <Field label="Apa yang menjadi penyebab stresmu?" hint="Wajib diisi bila menjawab Ya"><textarea rows={3} maxLength={1000} value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Tuliskan singkat saja…" /></Field>}
      </section>
      {submit.error && <Notice kind="error">{submit.error}</Notice>}
      {submit.success && <Notice kind="success">{submit.success}</Notice>}
      <SaveBar busy={submit.busy} label="Simpan perasaan" onCancel={onCancel} />
    </form>
  )
}

type MealDraft = { mealType: MealType; eatenAt: string; foodName: string; foodCategory: FoodCategory | ''; portionSize: string; servings: number; mindfulness: number | null }
const newMeal = (): MealDraft => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const type = mealTypes[hour < 10 ? 0 : hour < 15 ? 1 : hour < 18 ? 3 : 2]!
  return { mealType: type.value, eatenAt: type.time, foodName: '', foodCategory: '', portionSize: 'Sedang', servings: 1, mindfulness: null }
}

function MealForm({ date, day, onSaved, onCancel }: { date: string; day: DayData; onSaved: () => Promise<unknown>; onCancel: () => void }) {
  const [meal, setMeal] = useState<MealDraft>(newMeal)
  const [editing, setEditing] = useState<string | null>(null)
  const startEdit = (m: Meal) => {
    setEditing(m.id)
    setMeal({ mealType: m.mealType, eatenAt: m.eatenAt, foodName: m.foodName, foodCategory: m.foodCategory, portionSize: m.portionSize, servings: m.servings, mindfulness: m.mindfulness })
    submit.setError(''); submit.setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const submit = useSubmit(async (fillSeconds) => {
    if (!meal.foodName.trim()) throw new ApiError(400, 'Tuliskan makanan yang dikonsumsi.')
    if (!meal.foodCategory) throw new ApiError(400, 'Pilih kategori makanan.')
    if (!meal.eatenAt) throw new ApiError(400, 'Isi waktu makan.')
    if (meal.mindfulness === null) throw new ApiError(400, 'Jawab pertanyaan terakhir: seberapa besar kamu memperhatikan saat makan.')
    const body = { ...meal, foodName: meal.foodName.trim(), foodCategory: meal.foodCategory, mindfulness: meal.mindfulness, fillSeconds }
    if (editing) await api.updateMeal(editing, body)
    else await api.createMeal({ ...body, entryDate: date })
    await onSaved()
    setEditing(null)
    setMeal(newMeal())
  })
  return (
    <form className="form-page" {...submit.track} onSubmit={(e) => submit.run(e, editing ? 'Catatan makan diperbarui.' : 'Catatan makan tersimpan.')} noValidate>
      <section className="form-card intro-card"><span className="form-card-icon amber"><Utensils size={22} /></span><div><p className="step-label">CATATAN MAKAN</p><h2>{editing ? 'Perbaiki catatan makan' : 'Apa yang kamu makan?'}</h2><p>Catat sesuai yang kamu ingat. Tidak perlu menghitung kalori.</p></div></section>
      <section className="form-card field-stack">
        <div className="field-pair">
          <Field label="Waktu makan"><Select required value={meal.mealType} options={mealTypes} onChange={(v) => { const t = mealTypes.find((m) => m.value === v); setMeal({ ...meal, mealType: v as MealType, eatenAt: editing ? meal.eatenAt : t?.time ?? meal.eatenAt }) }} /></Field>
          <Field label="Jam"><input type="time" value={meal.eatenAt} onChange={(e) => setMeal({ ...meal, eatenAt: e.target.value })} required /></Field>
        </div>
        <Field label="Makanan yang dikonsumsi"><textarea rows={2} maxLength={500} value={meal.foodName} onChange={(e) => setMeal({ ...meal, foodName: e.target.value })} placeholder="Contoh: nasi, ayam bakar, tumis kangkung" required /></Field>
        <fieldset className="chip-group">
          <legend>Kategori utama</legend>
          <div role="radiogroup" aria-label="Kategori makanan">
            {foodCategories.map((c) => <button type="button" role="radio" aria-checked={meal.foodCategory === c.value} key={c.value} className={meal.foodCategory === c.value ? 'selected' : ''} onClick={() => setMeal({ ...meal, foodCategory: c.value })}>{c.label}</button>)}
          </div>
        </fieldset>
        <div className="field-pair">
          <Field label="Ukuran porsi"><Select required value={meal.portionSize} options={portionOptions} onChange={(portionSize) => setMeal({ ...meal, portionSize })} /></Field>
          <Field label="Jumlah sajian"><div className="stepper"><button type="button" aria-label="Kurangi" onClick={() => setMeal({ ...meal, servings: Math.max(1, meal.servings - 1) })}>−</button><output>{meal.servings}</output><button type="button" aria-label="Tambah" onClick={() => setMeal({ ...meal, servings: Math.min(20, meal.servings + 1) })}>+</button></div></Field>
        </div>
        <fieldset className="rating-list">
          <legend>Saat makan tadi, seberapa besar kamu memperhatikan apa yang kamu makan dan kamu rasakan?</legend>
          <div role="radiogroup" aria-label="Perhatian saat makan">
            {mindfulnessOptions.map((o) => (
              <button type="button" role="radio" key={o.value} aria-checked={meal.mindfulness === o.value} className={meal.mindfulness === o.value ? 'selected' : ''} onClick={() => setMeal({ ...meal, mindfulness: o.value })}>
                <b>{o.value}</b><span>{o.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setMeal(newMeal()) }}>Batal memperbaiki</button>}
      </section>
      {day.meals.length > 0 && (
        <section className="form-card saved-meals">
          <h3>Sudah tercatat ({day.meals.length})</h3>
          {day.meals.map((m) => (
            <button type="button" key={m.id} className={editing === m.id ? 'editing' : ''} onClick={() => startEdit(m)} aria-label={`Perbaiki ${labelOf(mealTypes, m.mealType)} ${m.eatenAt}`}>
              <span><Utensils size={16} /></span>
              <p><strong>{labelOf(mealTypes, m.mealType)} · {m.eatenAt}</strong><small>{m.foodName} · {labelOf(foodCategories, m.foodCategory)} · {m.portionSize} · {m.servings} sajian{m.mindfulness ? ` · perhatian ${m.mindfulness}/5` : ''}</small></p>
              <Pencil size={15} />
            </button>
          ))}
        </section>
      )}
      <MealsCompleteCard date={date} value={day.mealsComplete} onSaved={onSaved} />
      {submit.error && <Notice kind="error">{submit.error}</Notice>}
      {submit.success && <Notice kind="success">{submit.success}</Notice>}
      <SaveBar busy={submit.busy} label={editing ? 'Perbarui makanan' : 'Simpan makanan'} onCancel={onCancel} />
    </form>
  )
}

function SleepForm({ date, day, onSaved, onCancel }: { date: string; day: DayData; onSaved: () => Promise<unknown>; onCancel: () => void }) {
  const [hours, setHours] = useState(day.sleep ? String(day.sleep.durationHours) : '')
  const [quality, setQuality] = useState(day.sleep?.quality)
  const [obstacle, setObstacle] = useState(day.sleep?.obstacle ?? '')
  const submit = useSubmit(async (fillSeconds) => {
    const durationHours = Number(hours.replace(',', '.'))
    if (hours.trim() === '' || Number.isNaN(durationHours) || durationHours < 0 || durationHours > 24) throw new ApiError(400, 'Isi durasi tidur antara 0–24 jam.')
    if (!quality) throw new ApiError(400, 'Pilih kualitas tidurmu (1–5).')
    await api.saveSleep({ entryDate: date, durationHours, quality, obstacle: obstacle.trim() || null, fillSeconds })
    await onSaved()
  })
  return (
    <form className="form-page" {...submit.track} onSubmit={(e) => submit.run(e, 'Catatan tidur tersimpan.')} noValidate>
      <section className="form-card intro-card"><span className="form-card-icon blue"><BedDouble size={22} /></span><div><p className="step-label">TIDUR</p><h2>Bagaimana tidurmu semalam?</h2><p>Perkiraan saja tidak apa-apa.</p></div></section>
      <section className="form-card field-stack">
        <Field label="Durasi tidur (jam)"><div className="number-input"><input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="7.5" /><span>jam</span></div></Field>
        <div><h3>Kualitas tidur</h3><ScalePicker label="Pilih kualitas tidur" options={sleepOptions} value={quality} onChange={setQuality} /></div>
        <Field label="Apa yang menjadi hambatanmu saat tidur?" hint="Opsional"><textarea rows={3} maxLength={1000} value={obstacle} onChange={(e) => setObstacle(e.target.value)} placeholder="Contoh: sulit mulai tidur, sering terbangun…" /></Field>
      </section>
      {submit.error && <Notice kind="error">{submit.error}</Notice>}
      {submit.success && <Notice kind="success">{submit.success}</Notice>}
      <SaveBar busy={submit.busy} label="Simpan tidur" onCancel={onCancel} />
    </form>
  )
}

/** "Tidak makan" vs "lupa mencatat": hari yang belum lengkap tidak dipakai untuk analisis makanan. */
function MealsCompleteCard({ date, value, onSaved }: { date: string; value: boolean | null; onSaved: () => Promise<unknown> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const which = date === jakartaToday() ? 'hari ini' : 'kemarin'
  const set = async (next: boolean) => {
    setError(''); setSaving(true)
    try { await api.setMealsComplete(date, next); await onSaved() } catch (err) { setError(errorText(err)) } finally { setSaving(false) }
  }
  return (
    <section className="form-card meals-complete" aria-busy={saving}>
      <ToggleQuestion label={`Apakah semua makanmu ${which} sudah dicatat?`} value={value ?? undefined} onChange={set} noLabel="Belum" yesLabel="Ya, sudah semua" />
      <p className="insight-help">Termasuk camilan dan minuman manis. Bila kamu memang tidak makan di waktu tertentu, tetap pilih "Ya, sudah semua".</p>
      {error && <Notice kind="error">{error}</Notice>}
    </section>
  )
}

/* ---------- Kuesioner akhir studi (PRD bagian 11: hambatan & kemudahan) ---------- */

function FeedbackPage({ navigate }: { navigate: (view: View) => void }) {
  const [status, setStatus] = useState<FeedbackStatus | null>(null)
  const [ease, setEase] = useState<number | null>(null)
  const [barriers, setBarriers] = useState<Barrier[]>([])
  const [other, setOther] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    api.feedbackStatus().then((s) => {
      setStatus(s)
      if (s.feedback) { setEase(s.feedback.ease); setBarriers(s.feedback.barriers); setOther(s.feedback.barriersOther ?? ''); setSuggestion(s.feedback.suggestion ?? '') }
    }).catch(() => setStatus({ studyDay: 0, eligible: false, feedback: null }))
  }, [])
  const toggle = (b: Barrier) => setBarriers((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]))
  const submit = useSubmit(async () => {
    if (ease === null) throw new ApiError(400, 'Pilih seberapa mudah mengisi MoodBite.')
    if (barriers.includes('lainnya') && !other.trim()) throw new ApiError(400, 'Tuliskan hambatan lainnya.')
    await api.saveFeedback({ ease, barriers, barriersOther: barriers.includes('lainnya') ? other.trim() : null, suggestion: suggestion.trim() || null })
    setDone(true)
  })
  return (
    <div className="patient-shell log-shell">
      <header className="log-header">
        <button className="icon-button" onClick={() => navigate('today')} aria-label="Kembali"><ArrowLeft size={21} /></button>
        <div><h1>Pengalamanmu</h1><p>Kuesioner singkat akhir studi</p></div>
        <span />
      </header>
      {!status ? <Loading /> : done ? (
        <div className="form-page">
          <section className="form-card intro-card"><span className="form-card-icon green"><Check size={22} /></span><div><p className="step-label">TERIMA KASIH</p><h2>Masukanmu sudah tersimpan</h2><p>Terima kasih sudah mengikuti studi ini sampai akhir.</p></div></section>
          <button className="primary-button" onClick={() => navigate('today')}>Kembali ke beranda</button>
        </div>
      ) : (
        <form className="form-page" onSubmit={(e) => submit.run(e, 'Tersimpan.')} noValidate>
          <section className="form-card intro-card"><span className="form-card-icon green"><MessageSquareHeart size={22} /></span><div><p className="step-label">AKHIR STUDI</p><h2>Bagaimana pengalamanmu?</h2><p>Jawabanmu membantu tim peneliti memperbaiki cara pengumpulan data. Tidak ada jawaban benar atau salah.</p></div></section>
          <section className="form-card field-stack">
            <fieldset className="rating-list">
              <legend>Secara keseluruhan, seberapa mudah mengisi MoodBite setiap hari?</legend>
              <div role="radiogroup" aria-label="Kemudahan mengisi">
                {easeOptions.map((o) => (
                  <button type="button" role="radio" key={o.value} aria-checked={ease === o.value} className={ease === o.value ? 'selected' : ''} onClick={() => { setEase(o.value); submit.setError('') }}><b>{o.value}</b><span>{o.label}</span></button>
                ))}
              </div>
            </fieldset>
            <fieldset className="chip-group">
              <legend>Apa saja hambatan yang kamu alami? Boleh pilih lebih dari satu, atau kosongkan bila tidak ada.</legend>
              <div>
                {barrierOptions.map((o) => (
                  <button type="button" role="checkbox" key={o.value} aria-checked={barriers.includes(o.value)} className={barriers.includes(o.value) ? 'selected' : ''} onClick={() => toggle(o.value)}>{o.label}</button>
                ))}
              </div>
            </fieldset>
            {barriers.includes('lainnya') && <Field label="Hambatan lainnya"><textarea rows={2} maxLength={1000} value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
            <Field label="Ada saran untuk aplikasi ini?" hint="Opsional"><textarea rows={3} maxLength={1000} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} /></Field>
          </section>
          {submit.error && <Notice kind="error">{submit.error}</Notice>}
          <SaveBar busy={submit.busy} label="Kirim masukan" onCancel={() => navigate('today')} />
        </form>
      )}
    </div>
  )
}

function LogPage({ initialTab, navigate }: { initialTab: LogTab; navigate: (view: View) => void }) {
  const today = jakartaToday()
  const [tab, setTab] = useState<LogTab>(initialTab)
  const [date, setDate] = useState(today)
  const { day, error, reload } = useDay(date)
  const back = () => navigate('today')

  const tabs: Array<{ key: LogTab; label: string; icon: React.ReactNode; done?: boolean }> = [
    { key: 'mood', label: 'Perasaan', icon: <HeartPulse size={17} />, done: !!day?.mood },
    { key: 'meal', label: 'Makan', icon: <Utensils size={17} />, done: !!day?.meals.length },
    { key: 'sleep', label: 'Tidur', icon: <MoonStar size={17} />, done: !!day?.sleep },
    { key: 'profile', label: 'Profil', icon: <UserRound size={17} /> },
  ]

  return (
    <div className="patient-shell log-shell">
      <header className="log-header">
        <button className="icon-button" onClick={back} aria-label="Kembali"><ArrowLeft size={21} /></button>
        <div><h1>{tab === 'profile' ? 'Profil' : 'Catatan harian'}</h1><p>{tab === 'profile' ? 'Data awal partisipan' : formatLongDate(date)}</p></div>
        <span />
      </header>
      <nav className="log-tabs" aria-label="Bagian formulir">
        {tabs.map((item) => (
          <button key={item.key} className={tab === item.key ? 'active' : ''} aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)}>
            {item.icon}<span>{item.label}{item.done && <Check size={11} className="tab-done" aria-label="sudah diisi" />}</span>
          </button>
        ))}
      </nav>
      {tab !== 'profile' && (
        <div className="date-switch" role="radiogroup" aria-label="Tanggal catatan">
          {[{ d: today, l: 'Hari ini' }, { d: shiftDate(today, -1), l: 'Kemarin' }].map(({ d, l }) => (
            <button key={d} type="button" role="radio" aria-checked={date === d} className={date === d ? 'selected' : ''} onClick={() => setDate(d)}>{l} <small>{formatShortDate(d)}</small></button>
          ))}
        </div>
      )}
      {tab === 'profile' ? <ProfileForm onSaved={() => undefined} onCancel={back} />
        : error ? <div className="form-page"><Notice kind="error">{error}</Notice></div>
        : !day ? <Loading />
        : tab === 'mood' ? <MoodForm key={`mood-${date}`} date={date} day={day} onSaved={reload} onCancel={back} />
        : tab === 'meal' ? <MealForm key={`meal-${date}`} date={date} day={day} onSaved={reload} onCancel={back} />
        : <SleepForm key={`sleep-${date}`} date={date} day={day} onSaved={reload} onCancel={back} />}
    </div>
  )
}

/* ---------- Riwayat ---------- */

function HistoryPage({ me, navigate, onLogout }: { me: Me; navigate: (view: View, tab?: LogTab) => void; onLogout: () => void }) {
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState('')
  const [insights, setInsights] = useState<PersonalInsights | null>(null)
  useEffect(() => {
    api.history().then(setHistory).catch((e) => setError(errorText(e)))
    if (me.insightsEnabled) api.insights().then(setInsights).catch(() => setInsights(null))
  }, [me.insightsEnabled])
  const today = jakartaToday()
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(today, -i))
  const patterns = insights?.findings.filter((f) => f.verdict === 'higher' || f.verdict === 'lower') ?? []

  return (
    <div className="patient-shell">
      <PatientHeader me={me} onLogout={onLogout} />
      <main className="patient-main">
        <div className="section-heading compact"><div><h2>Riwayat 7 hari</h2><p>Hanya kamu yang bisa melihat catatan ini</p></div></div>
        {error && <Notice kind="error">{error}</Notice>}
        {insights && (
          <>
            <section className="form-card insight-card">
              <h3>Hubungan antar catatanmu</h3>
              <p className="insight-help">Ketuk satu hari untuk melihat mood, stres, tidur, dan makanmu di hari yang sama.</p>
              <LinkedTimeline dates={[...dates].reverse()} days={insights.days} />
            </section>
            <section className="form-card insight-card">
              <h3><Lightbulb size={17} /> Pola dari catatanmu</h3>
              {patterns.length ? (
                <ul className="pattern-list">{patterns.map((f) => <li key={f.id}>{personalSentence(f)}</li>)}</ul>
              ) : (
                <p className="insight-help">Belum terlihat pola yang jelas dari {insights.totalDays} hari catatanmu. Pola lebih mudah terlihat bila kamu rutin mengisi makan, perasaan, dan tidur setiap hari.</p>
              )}
              <p className="insight-note">Pola ini dihitung dari catatanmu sendiri dan bisa berubah. Ini bukan diagnosis atau saran pengobatan.</p>
            </section>
          </>
        )}
        {!history && !error && <Loading />}
        {history && dates.map((date) => {
          const meals = history.meals.find((d) => d.entryDate === date)?.entries ?? []
          const mood = history.moods.find((d) => d.entryDate === date)?.entries.at(-1)
          const sleep = history.sleep.find((s) => s.entryDate === date)
          const m = moodOptions.find((o) => o.value === mood?.mood)
          const count = [meals.length > 0, !!mood, !!sleep].filter(Boolean).length
          return (
            <article key={date} className="form-card history-day">
              <header>
                <h3>{date === today ? 'Hari ini' : formatLongDate(date)}</h3>
                <span className={`status ${count === 3 ? 'good' : count ? 'warning' : 'neutral'}`}>{count}/3 terisi</span>
              </header>
              <dl>
                <div><dt><HeartPulse size={14} /> Perasaan</dt><dd>{m ? `${m.value} · ${m.label}` : '–'}</dd></div>
                <div><dt><Zap size={14} /> Stres</dt><dd>{!mood ? '–' : mood.isStressed ? `Ya · ${mood.stressCause}` : 'Tidak'}</dd></div>
                <div><dt><MoonStar size={14} /> Tidur</dt><dd>{sleep ? `${sleep.durationHours} jam · kualitas ${sleep.quality}/5` : '–'}</dd></div>
                <div><dt><Utensils size={14} /> Makan</dt><dd>{meals.length ? meals.map((x) => `${labelOf(mealTypes, x.mealType)}: ${x.foodName}`).join(' · ') : '–'}</dd></div>
              </dl>
              {(date === today || date === shiftDate(today, -1)) && count < 3 && <button className="text-button" onClick={() => navigate('log', !mood ? 'mood' : !meals.length ? 'meal' : 'sleep')}><Plus size={15} /> Lengkapi</button>}
            </article>
          )
        })}
        <p className="privacy-note"><ShieldCheck size={16} /> Catatan hari ini dan kemarin masih bisa diperbaiki.</p>
      </main>
      <BottomNav active="history" onChange={navigate} />
    </div>
  )
}

export function PatientApp({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [view, setView] = useState<View>('today')
  const [tab, setTab] = useState<LogTab>('mood')
  const navigate = (next: View, nextTab?: LogTab) => { if (nextTab) setTab(nextTab); setView(next); window.scrollTo(0, 0) }

  if (view === 'log') return <LogPage key={tab} initialTab={tab} navigate={navigate} />
  if (view === 'history') return <HistoryPage me={me} navigate={navigate} onLogout={onLogout} />
  if (view === 'feedback') return <FeedbackPage navigate={navigate} />
  return <TodayPage me={me} navigate={navigate} onLogout={onLogout} />
}
