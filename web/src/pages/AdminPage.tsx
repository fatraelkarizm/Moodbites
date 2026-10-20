import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Check, ChevronRight, ClipboardCheck, Copy, Flag, KeyRound, RotateCcw, UserPlus, GitCompareArrows, Download, FileSpreadsheet, HeartPulse, LayoutDashboard, LogOut, Menu, MoonStar,
  RefreshCw, ShieldCheck, UsersRound, X,
} from 'lucide-react'
import { Brand, EmotionFace, Loading, Notice } from '../components'
import { barrierOptions, foodCategories, labelOf, moodOptions, type ScaleOption } from '../data'
import { api, ApiError, exportTables, type Analytics, type Me, type ResearchInsights, type Feasibility, type PatientList, type PatientCredential } from '../lib/api'
import { ForestTable, LinkedTimeline } from '../insights'
import { researchSentence } from '../lib/insights'
import { dateRange, formatFullDate, formatShortDate, jakartaToday, shiftDate } from '../lib/date'

const MOOD_COLOR = '#d0603f'
const STRESS_COLOR = '#3a78c2'
const SLEEP_COLOR = '#2f6f68'

type Series = { label: string; color: string; values: Array<number | null>; format: (v: number) => string }

/** Grafik garis satu sumbu dengan crosshair + tooltip. Nilai null memutus garis (hari tanpa data). */
function TrendChart({ dates, series, domain, ticks, label }: { dates: string[]; series: Series[]; domain: [number, number]; ticks: number[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [width, setWidth] = useState(520)
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(260, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const W = width, H = 190, L = 30, R = 14, T = 12, B = 26
  const n = dates.length
  const step = n > 1 ? (W - L - R) / (n - 1) : 0
  const x = (i: number) => (n > 1 ? L + i * step : (L + W - R) / 2)
  const y = (v: number) => T + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - T - B)
  const every = Math.max(1, Math.ceil(n / 7))

  const path = (values: Array<number | null>) => values.reduce((d, v, i) => {
    if (v === null) return d
    return `${d}${i > 0 && values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  }, '')

  const onMove = (event: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !n) return
    const px = ((event.clientX - rect.left) / rect.width) * W
    setHover(Math.min(n - 1, Math.max(0, n > 1 ? Math.round((px - L) / step) : 0)))
  }

  return (
    <div className="line-chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} y1={y(t)} x2={W - R} y2={y(t)} className="gridline" /><text x={L - 8} y={y(t) + 3} className="axis-label" textAnchor="end">{t}</text></g>)}
        {dates.map((d, i) => i % every === 0 && <text key={d} x={x(i)} y={H - 6} className="axis-label" textAnchor="middle">{formatShortDate(d)}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="crosshair" />}
        {series.map((s) => (
          <g key={s.label}>
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v, i) => v !== null && (
              <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill="white" stroke={s.color} strokeWidth={2} />
            ))}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{formatShortDate(dates[hover]!)}</strong>
          {series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}: <b>{s.values[hover] === null ? 'tidak ada data' : s.format(s.values[hover]!)}</b></span>)}
        </div>
      )}
    </div>
  )
}

function ScaleDistribution({ options, counts }: { options: ScaleOption[]; counts: Map<number, number> }) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return (
    <div className="distribution-bars">
      {options.map((option) => {
        const count = counts.get(option.value) ?? 0
        const pct = total ? Math.round((count / total) * 100) : 0
        return (
          <div key={option.value} title={`${option.value} – ${option.label}: ${count} catatan (${pct}%)`}>
            <span aria-hidden><EmotionFace level={option.value} color={option.color} size={22} /></span><i><b style={{ width: `${pct}%`, background: option.color }} /></i><strong>{pct}%</strong>
            <small>{option.value} · {option.label} ({count})</small>
          </div>
        )
      })}
    </div>
  )
}

const weightedMean = (rows: Array<{ value: number; count: number }>) => {
  const n = rows.reduce((a, r) => a + r.count, 0)
  return n ? rows.reduce((a, r) => a + r.value * r.count, 0) / n : null
}

const exportInfo: Record<(typeof exportTables)[number], string> = {
  daily_summary: 'Gabungan per partisipan per hari',
  patient_profiles: 'Profil awal partisipan',
  meal_entries: 'Catatan makan',
  mood_entries: 'Perasaan & stres',
  sleep_entries: 'Catatan tidur',
  study_feedback: 'Kuesioner akhir studi',
}

const minutes = (s: number | null) => (s === null ? '–' : (s / 60).toLocaleString('id-ID', { maximumFractionDigits: 1 }))
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** Kriteria keberhasilan feasibility (PRD bagian 11), dihitung atas seluruh studi. */
function FeasibilityPanel({ data }: { data: Feasibility }) {
  const fb = data.feedback
  return (
    <section className="panel feasibility-panel" id="kelayakan">
      <div className="panel-title"><div><h3>Kelayakan studi (PRD bagian 11)</h3><p>Seluruh studi, tidak terpengaruh filter tanggal. Hari studi dihitung {data.studyDays} hari sejak catatan pertama tiap partisipan.</p></div></div>
      <div className="feas-grid">
        <div className="feas-stat"><p>Menyelesaikan {data.studyDays} hari lengkap</p><strong>{data.finishedComplete} <small>/ {data.patientsStarted} partisipan</small></strong><span>{pct(data.finishedComplete, data.patientsStarted)}% · {data.inProgress} masih berjalan</span></div>
        <div className="feas-stat"><p>Mengisi sesuatu {data.studyDays} hari</p><strong>{data.finishedActive} <small>/ {data.patientsStarted}</small></strong><span>{data.patientsTotal - data.patientsStarted} akun belum pernah mengisi</span></div>
        <div className="feas-stat"><p>Waktu mengisi per hari (median)</p><strong>{minutes(data.fillTime.medianSeconds)} <small>menit</small></strong><span>IQR {minutes(data.fillTime.p25Seconds)}–{minutes(data.fillTime.p75Seconds)} menit · {data.fillTime.patientDays} hari-partisipan</span></div>
        <div className="feas-stat"><p>Kemudahan mengisi (1–5)</p><strong>{fb.easeMean === null ? '–' : fb.easeMean.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small>/ 5</small></strong><span>{fb.responses} dari {data.patientsStarted} mengisi kuesioner akhir</span></div>
      </div>
      <div className="feas-cols">
        <div>
          <h4>Hambatan yang dilaporkan</h4>
          {fb.barriers.length === 0 ? <p className="empty-text">Belum ada jawaban.</p> : (
            <div className="bar-list">
              {fb.barriers.map((b) => (
                <div key={b.barrier}><span>{labelOf(barrierOptions, b.barrier)}</span><i><b style={{ width: `${pct(b.count, fb.responses)}%` }} /></i><strong>{b.count} <small>({pct(b.count, fb.responses)}%)</small></strong></div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4>Komentar & saran partisipan</h4>
          {fb.comments.length === 0 ? <p className="empty-text">Belum ada komentar.</p> : (
            <ul className="comment-list">
              {fb.comments.map((c, i) => <li key={i}><strong>{c.patientCode}</strong>{c.barriersOther && <span> Hambatan lain: {c.barriersOther}.</span>}{c.suggestion && <span> {c.suggestion}</span>}</li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

/** Manajemen akun pasien oleh peneliti: membuat akun dan mereset PIN. PIN hanya tampil sekali. */
function PatientsPanel() {
  const [list, setList] = useState<PatientList | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [credential, setCredential] = useState<(PatientCredential & { reset: boolean }) | null>(null)
  const [copied, setCopied] = useState(false)

  const load = () => api.patients().then((l) => { setList(l); setCode(l.suggestedCode) }).catch((e) => setError(e instanceof ApiError ? e.message : 'Gagal memuat daftar pasien.'))
  useEffect(() => { load() }, [])

  const show = (c: PatientCredential, reset: boolean) => { setCredential({ ...c, reset }); setCopied(false); load() }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!/^[A-Z0-9-]{2,20}$/.test(normalized)) { setError('Kode hanya boleh huruf, angka, atau tanda hubung (2–20 karakter).'); return }
    setError(''); setBusy(true)
    try { show(await api.createPatient(normalized), false) } catch (e) { setError(e instanceof ApiError ? e.message : 'Gagal membuat akun.') } finally { setBusy(false) }
  }

  const reset = async (patientCode: string) => {
    if (!window.confirm(`Reset PIN ${patientCode}?\n\nPIN lama langsung tidak berlaku dan pasien akan keluar dari HP-nya. Berikan PIN baru kepada pasien.`)) return
    setError(''); setBusy(true)
    try { show(await api.resetPatientPin(patientCode), true) } catch (e) { setError(e instanceof ApiError ? e.message : 'Gagal mereset PIN.') } finally { setBusy(false) }
  }

  const copy = async () => {
    if (!credential) return
    try { await navigator.clipboard.writeText(`Kode: ${credential.code}\nPIN: ${credential.pin}`); setCopied(true) } catch { setCopied(false) }
  }

  const status = (p: PatientList['patients'][number]) =>
    p.locked ? { label: 'Terkunci', cls: 'warning' } : !p.onboardingComplete ? { label: 'Belum onboarding', cls: 'neutral' } : { label: 'Aktif', cls: 'good' }

  return (
    <section className="panel manage-panel" id="kelola">
      <div className="panel-title"><div><h3>Kelola pasien</h3><p>Buat akun pasien baru atau reset PIN. Data pasien tetap hanya kode, tanpa nama atau nomor HP.</p></div></div>

      <form className="manage-create" onSubmit={create}>
        <label className="field"><span>Kode pasien baru</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} placeholder="P001" aria-describedby="code-hint" /></label>
        <button type="submit" className="primary-button" disabled={busy}><UserPlus size={17} /> {busy ? 'Memproses…' : 'Buat akun'}</button>
        <small id="code-hint">Kode disarankan otomatis dan boleh diubah. PIN 8 angka dibuat acak oleh sistem.</small>
      </form>

      {error && <Notice kind="error">{error}</Notice>}

      {credential && (
        <div className="credential-card" role="status">
          <div>
            <p className="eyebrow">{credential.reset ? 'PIN BARU' : 'AKUN DIBUAT'}</p>
            <dl><div><dt>Kode</dt><dd>{credential.code}</dd></div><div><dt>PIN</dt><dd>{credential.pin}</dd></div></dl>
            <p className="credential-warning"><KeyRound size={14} /> PIN ini <strong>hanya ditampilkan sekali</strong>. Catat sekarang dan berikan langsung ke pasien, sebaiknya terpisah dari link aplikasi.</p>
          </div>
          <div className="credential-actions">
            <button type="button" className="secondary-button" onClick={copy}>{copied ? <><Check size={15} /> Tersalin</> : <><Copy size={15} /> Salin kode & PIN</>}</button>
            <button type="button" className="primary-button" onClick={() => setCredential(null)}>Sudah dicatat</button>
          </div>
        </div>
      )}

      <div className="table-wrap"><table>
        <thead><tr><th>Kode</th><th>Status</th><th>Terakhir mengisi</th><th>Hari tercatat</th><th>Dibuat</th><th /></tr></thead>
        <tbody>
          {!list && <tr><td colSpan={6}>Memuat…</td></tr>}
          {list?.patients.length === 0 && <tr><td colSpan={6}>Belum ada pasien. Buat akun pertama di atas.</td></tr>}
          {list?.patients.map((p) => {
            const st = status(p)
            return (
              <tr key={p.code}>
                <td><strong>{p.code}</strong></td>
                <td><span className={`status ${st.cls}`}>{st.label}</span></td>
                <td>{p.lastEntryDate ? formatShortDate(p.lastEntryDate) : '–'}</td>
                <td>{p.activeDays} hari</td>
                <td>{formatShortDate(p.createdAt.slice(0, 10))}{p.pinResetAt ? ' · PIN direset' : ''}</td>
                <td><button type="button" className="text-button" disabled={busy} onClick={() => reset(p.code)}><RotateCcw size={14} /> Reset PIN</button></td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
    </section>
  )
}

type Section = 'ringkasan' | 'kelola' | 'kelayakan' | 'tren' | 'hubungan' | 'partisipan' | 'ekspor'
const SECTIONS: Array<{ id: Section; label: string; eyebrow: string; description: string; icon: typeof LayoutDashboard; usesFilters: boolean }> = [
  { id: 'ringkasan', label: 'Ringkasan', eyebrow: 'ANALITIK DESKRIPTIF', description: 'Angka utama dan kelengkapan pengisian', icon: LayoutDashboard, usesFilters: true },
  { id: 'kelola', label: 'Kelola pasien', eyebrow: 'AKUN PASIEN', description: 'Buat akun pasien baru dan reset PIN', icon: UserPlus, usesFilters: false },
  { id: 'kelayakan', label: 'Kelayakan studi', eyebrow: 'PRD BAGIAN 11', description: 'Penyelesaian 7 hari, waktu mengisi, kemudahan, dan hambatan', icon: Flag, usesFilters: false },
  { id: 'tren', label: 'Tren & distribusi', eyebrow: 'ANALITIK DESKRIPTIF', description: 'Stres, kategori makanan, emosi, dan tidur per hari', icon: Activity, usesFilters: true },
  { id: 'hubungan', label: 'Analisis hubungan', eyebrow: 'ANALISIS WITHIN-PERSON', description: 'Hubungan makanan, tidur, dan stres dengan emosi', icon: GitCompareArrows, usesFilters: true },
  { id: 'partisipan', label: 'Partisipan', eyebrow: 'KELENGKAPAN', description: 'Kelengkapan pengisian per partisipan', icon: UsersRound, usesFilters: true },
  { id: 'ekspor', label: 'Ekspor data', eyebrow: 'UNDUH CSV', description: 'File CSV untuk Excel, SPSS, R, atau Python', icon: Download, usesFilters: false },
]
const sectionFromHash = (): Section => {
  const id = window.location.hash.slice(1)
  return SECTIONS.some((s) => s.id === id) ? (id as Section) : 'ringkasan'
}

export function AdminPage({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const today = jakartaToday()
  const [filters, setFilters] = useState({ from: shiftDate(today, -6), to: today, code: '' })
  const [form, setForm] = useState(filters)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [lag, setLag] = useState<0 | 1>(0)
  const [insights, setInsights] = useState<ResearchInsights | null>(null)
  const [insightError, setInsightError] = useState('')
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null)
  const loadFeasibility = () => { api.feasibility().then(setFeasibility).catch(() => setFeasibility(null)) }
  useEffect(() => { if (section === 'kelayakan') loadFeasibility() }, [section])
  useEffect(() => {
    if (section !== 'hubungan') return
    setInsightError(''); setInsights(null)
    api.adminInsights(filters.from, filters.to, filters.code || undefined, lag)
      .then(setInsights)
      .catch((e) => { setInsights(null); setInsightError(e instanceof ApiError ? e.message : 'Gagal memuat analisis.') })
  }, [filters, lag, section, reloadKey])

  const load = () => {
    setLoading(true); setError('')
    api.analytics(filters.from, filters.to, filters.code || undefined)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [filters])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (form.from > form.to) { setError('Tanggal awal harus sebelum tanggal akhir.'); return }
    setFilters({ ...form, code: form.code.trim().toUpperCase() })
  }
  const preset = (days: number) => {
    const next = { ...form, from: shiftDate(today, -(days - 1)), to: today }
    setForm(next); setFilters({ ...next, code: next.code.trim().toUpperCase() })
  }

  const view = useMemo(() => {
    if (!data) return null
    const dates = dateRange(filters.from, filters.to)
    const byPatient = new Map<string, { days: number; complete: number; meal: number; mood: number; sleep: number }>()
    let complete = 0, partial = 0, empty = 0
    for (const r of data.completion) {
      const p = byPatient.get(r.patientCode) ?? { days: 0, complete: 0, meal: 0, mood: 0, sleep: 0 }
      const filled = [r.hasMeal, r.hasMood, r.hasSleep].filter(Boolean).length
      p.days++; p.meal += +r.hasMeal; p.mood += +r.hasMood; p.sleep += +r.hasSleep
      if (filled === 3) { p.complete++; complete++ } else if (filled) partial++; else empty++
      byPatient.set(r.patientCode, p)
    }
    const trendByDate = new Map(data.trend.map((t) => [t.date, t]))
    const pick = (key: 'averageMood' | 'averageSleepHours') => dates.map((d) => trendByDate.get(d)?.[key] ?? null)
    const stressPct = dates.map((d) => { const t = trendByDate.get(d); return t && t.moodCheckins ? Math.round((t.stressedCheckins / t.moodCheckins) * 100) : null })
    const sleepHours = pick('averageSleepHours').filter((v): v is number => v !== null)
    const moodCounts = new Map(data.distributions.mood.map((r) => [r.mood, r.count]))
    const stressedYes = data.distributions.stressed.find((r) => r.isStressed)?.count ?? 0
    const stressedTotal = data.distributions.stressed.reduce((a, r) => a + r.count, 0)
    const categoryTotal = data.distributions.foodCategory.reduce((a, r) => a + r.count, 0)
    return {
      dates, complete, partial, empty,
      patients: [...byPatient.entries()].map(([code, p]) => ({ code, ...p, rate: p.days ? p.complete / p.days : 0 })),
      moodSeries: pick('averageMood'), stressSeries: stressPct, sleepSeries: pick('averageSleepHours'),
      avgMood: weightedMean(data.distributions.mood.map((r) => ({ value: r.mood, count: r.count }))),
      stressedYes, stressedTotal,
      avgSleep: sleepHours.length ? sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length : null,
      moodCounts, moodTotal: [...moodCounts.values()].reduce((a, b) => a + b, 0),
      categories: data.distributions.foodCategory, categoryTotal,
    }
  }, [data, filters])

  const fmt1 = (v: number | null) => (v === null ? '–' : v.toFixed(1))
  const reloadAll = () => { load(); if (section === 'kelayakan') loadFeasibility(); setReloadKey((k) => k + 1) }
  const meta = SECTIONS.find((s) => s.id === section)!
  const go = (id: Section) => { setMobileMenu(false); if (id !== section) window.location.hash = id; window.scrollTo(0, 0) }

  const kpis = view && (
    <section className="kpi-grid" aria-busy={loading}>
      <article className="kpi-card"><span className="kpi-icon teal"><UsersRound size={21} /></span><div><p>Partisipan</p><strong>{view.patients.length}</strong><span>{data!.summary.patientDays} hari-partisipan</span></div></article>
      <article className="kpi-card"><span className="kpi-icon amber"><ClipboardCheck size={21} /></span><div><p>Hari terisi lengkap</p><strong>{Math.round(data!.summary.completionRate * 100)}%</strong><span>{data!.summary.fullyComplete} dari {data!.summary.patientDays} hari</span></div></article>
      <article className="kpi-card"><span className="kpi-icon coral"><HeartPulse size={21} /></span><div><p>Rerata skor emosi (0 senang – 5 marah sekali)</p><strong>{fmt1(view.avgMood)} <small>/ 5</small></strong><span>{view.stressedTotal ? Math.round((view.stressedYes / view.stressedTotal) * 100) : 0}% check-in merasa stres (n = {view.moodTotal})</span></div></article>
      <article className="kpi-card"><span className="kpi-icon blue"><MoonStar size={21} /></span><div><p>Rerata durasi tidur</p><strong>{fmt1(view.avgSleep)} <small>jam</small></strong><span>rerata dari rerata harian</span></div></article>
    </section>
  )

  const renderSection = () => {
    switch (section) {
      case 'kelola':
        return <PatientsPanel key={reloadKey} />
      case 'kelayakan':
        return feasibility ? <FeasibilityPanel data={feasibility} /> : <Loading label="Memuat metrik kelayakan…" />
      case 'ekspor':
        return (
          <section className="panel export-panel" id="ekspor">
            <div className="panel-title"><div><h3>Ekspor CSV</h3><p>Berisi <strong>seluruh</strong> data (tidak terpengaruh filter), hanya kode partisipan tanpa id internal. Untuk analisis, mulai dari <strong>daily_summary.csv</strong>: satu baris per partisipan per hari, termasuk hari yang kosong.</p></div></div>
            <div className="export-grid">
              {exportTables.map((t) => (
                <a key={t} href={api.exportUrl(t)} download={`${t}.csv`} className={t === 'daily_summary' ? 'primary-export' : undefined}>
                  <FileSpreadsheet size={20} /><span><strong>{exportInfo[t]}</strong><small>{t}.csv</small></span><Download size={16} />
                </a>
              ))}
            </div>
          </section>
        )
    }
    if (!view) return loading ? <Loading label="Memuat analitik…" /> : null
    switch (section) {
      case 'ringkasan':
        return (
          <>
            {kpis}
            <section className="analytics-grid">
              <article className="panel">
                <div className="panel-title"><div><h3>Tren termometer emosi harian</h3><p>Rerata skor 0 (senang) – 5 (marah sekali) · makin tinggi = emosi makin berat</p></div></div>
                <TrendChart label="Rerata skor termometer emosi per hari, 0 senang sampai 5 marah sekali" dates={view.dates} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]}
                  series={[{ label: 'Skor emosi', color: MOOD_COLOR, values: view.moodSeries, format: (v) => `${v.toFixed(2)} (0–5)` }]} />
              </article>
              <article className="panel completion-panel">
                <div className="panel-title"><div><h3>Kelengkapan pengisian</h3><p>Per hari-partisipan (makan + perasaan + tidur)</p></div></div>
                <div className="donut" style={{ '--value': `${(view.complete / Math.max(1, data!.summary.patientDays)) * 100}%`, '--partial': `${((view.complete + view.partial) / Math.max(1, data!.summary.patientDays)) * 100}%` } as React.CSSProperties}>
                  <div><strong>{Math.round(data!.summary.completionRate * 100)}%</strong><span>lengkap</span></div>
                </div>
                <div className="completion-list"><span><i className="done" /> Lengkap <strong>{view.complete}</strong></span><span><i className="partial" /> Sebagian <strong>{view.partial}</strong></span><span><i className="none" /> Kosong <strong>{view.empty}</strong></span></div>
              </article>
            </section>
            <div className="section-links">
              {SECTIONS.filter((s) => s.id !== 'ringkasan').map((s) => (
                <button key={s.id} type="button" onClick={() => go(s.id)}><s.icon size={18} /><span><strong>{s.label}</strong><small>{s.description}</small></span><ChevronRight size={16} /></button>
              ))}
            </div>
          </>
        )
      case 'tren':
        return (
          <>
            <section className="analytics-grid first">
              <article className="panel">
                <div className="panel-title"><div><h3>Check-in yang merasa stres</h3><p>Persentase jawaban "Ya" per hari</p></div><span className="sample-size">{view.stressedYes} dari {view.stressedTotal}</span></div>
                <TrendChart label="Persentase check-in yang merasa stres per hari" dates={view.dates} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                  series={[{ label: 'Merasa stres', color: STRESS_COLOR, values: view.stressSeries, format: (v) => `${v}%` }]} />
              </article>
              <article className="panel">
                <div className="panel-title"><div><h3>Kategori makanan</h3><p>Proporsi catatan makan</p></div><span className="sample-size">n = {view.categoryTotal}</span></div>
                <div className="bar-list">
                  {view.categories.length === 0 && <p className="empty-text">Belum ada catatan makan.</p>}
                  {view.categories.map((c) => {
                    const pct = view.categoryTotal ? Math.round((c.count / view.categoryTotal) * 100) : 0
                    return <div key={c.foodCategory}><span>{labelOf(foodCategories, c.foodCategory).replace(/ \(.*\)/, '')}</span><i><b style={{ width: `${pct}%` }} /></i><strong>{c.count} <small>({pct}%)</small></strong></div>
                  })}
                </div>
              </article>
            </section>
            <section className="panel distribution-panel">
              <div className="panel-title"><div><h3>Distribusi termometer emosi</h3><p>Proporsi check-in pada rentang terpilih</p></div><span className="sample-size">n = {view.moodTotal}</span></div>
              <ScaleDistribution options={moodOptions} counts={view.moodCounts} />
            </section>
            <section className="panel distribution-panel">
              <div className="panel-title"><div><h3>Tren durasi tidur</h3><p>Rerata jam tidur per hari</p></div></div>
              <TrendChart label="Rerata durasi tidur per hari dalam jam" dates={view.dates} domain={[0, 12]} ticks={[0, 3, 6, 9, 12]}
                series={[{ label: 'Tidur', color: SLEEP_COLOR, values: view.sleepSeries, format: (v) => `${v.toFixed(1)} jam` }]} />
            </section>
          </>
        )
      case 'hubungan':
        return (
          <section className="panel relation-panel" id="hubungan">
            <div className="panel-title">
              <div><h3>Analisis hubungan makanan, tidur, stres & mood</h3><p>{insights ? `${insights.patients} partisipan · ${insights.observedDays} hari tercatat${filters.code ? ` · analisis personal ${filters.code}` : ''}` : 'Menghitung…'}</p></div>
              <div className="segmented" role="radiogroup" aria-label="Waktu efek makanan">
                <button type="button" role="radio" aria-checked={lag === 0} className={lag === 0 ? 'selected' : ''} onClick={() => setLag(0)}>Makanan: hari sama</button>
                <button type="button" role="radio" aria-checked={lag === 1} className={lag === 1 ? 'selected' : ''} onClick={() => setLag(1)}>Hari berikutnya</button>
              </div>
            </div>
            {insightError && <Notice kind="error">{insightError}</Notice>}
            {!insights && !insightError && <Loading label="Menghitung analisis hubungan…" />}
            {insights && (() => {
              const clear = insights.findings.filter((f) => f.verdict === 'higher' || f.verdict === 'lower').sort((a, b) => (a.q ?? 1) - (b.q ?? 1))
              return (
                <>
                  <div className="conclusions">
                    <h4>Kesimpulan</h4>
                    {clear.length ? <ol>{clear.map((f) => <li key={f.id}>{researchSentence(f)}</li>)}</ol>
                      : <p>Belum ada hubungan yang lolos uji pada rentang ini. Perkiraan dan rentang ketidakpastiannya tetap ditampilkan di tabel bawah.</p>}
                  </div>
                  {filters.code && <div className="relation-timeline"><h4>Timeline {filters.code}</h4><LinkedTimeline dates={view.dates} days={insights.days} /></div>}
                  <ForestTable title="Terhadap skor termometer emosi" caption="Perubahan skor emosi 0–5 (positif = emosi lebih berat), dibandingkan dengan hari lain pada orang yang sama" findings={insights.findings.filter((f) => f.outcome === 'mood')} />
                  <ForestTable title="Terhadap stres" caption="Perubahan proporsi menjawab “Ya, stres” (poin persen)" findings={insights.findings.filter((f) => f.outcome === 'stressed')} />
                  <p className="method-note">
                    <strong>Metode.</strong> Setiap partisipan dibandingkan dengan dirinya sendiri (within-person), lalu dirata-rata antar partisipan.
                    Interval kepercayaan 95% dari {filters.code ? 'bootstrap per hari' : 'cluster bootstrap per partisipan'} (2.000 iterasi); kesimpulan “terlihat” hanya bila CI tidak melewati 0
                    dan lolos koreksi banyak perbandingan Benjamini–Hochberg (q &lt; 0,05). Minimal {filters.code ? '2' : '5'} hari per kelompok{filters.code ? '' : ' dan 3 partisipan'}.
                    Ini asosiasi dari data observasional, bukan bukti sebab-akibat; perlu dikonfirmasi dengan analisis lanjutan (mis. model multilevel) pada data lebih besar.
                  </p>
                </>
              )
            })()}
          </section>
        )
      case 'partisipan':
        return (
          <section className="panel patient-panel" id="partisipan">
            <div className="panel-title"><div><h3>Kelengkapan per partisipan</h3><p>Jumlah hari yang terisi pada rentang terpilih</p></div></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Partisipan</th><th>Hari lengkap</th><th>Kelengkapan</th><th>Makan</th><th>Perasaan</th><th>Tidur</th><th>Status</th></tr></thead>
              <tbody>
                {view.patients.length === 0 && <tr><td colSpan={7}>Tidak ada partisipan yang cocok dengan filter.</td></tr>}
                {view.patients.map((p) => (
                  <tr key={p.code}>
                    <td><span className="table-avatar">{p.code.slice(0, 4)}</span><strong>{p.code}</strong></td>
                    <td>{p.complete} / {p.days}</td>
                    <td><div className="adherence"><span><i style={{ width: `${p.rate * 100}%` }} /></span>{Math.round(p.rate * 100)}%</div></td>
                    <td>{p.meal} hari</td><td>{p.mood} hari</td><td>{p.sleep} hari</td>
                    <td><span className={`status ${p.rate >= 0.8 ? 'good' : p.rate >= 0.5 ? 'warning' : 'neutral'}`}>{p.rate >= 0.8 ? 'Lengkap' : p.rate >= 0.5 ? 'Sebagian' : 'Perlu diingatkan'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        )
    }
    return null
  }

  return (
    <div className="admin-shell">
      <aside className={mobileMenu ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="sidebar-brand"><Brand /><button onClick={() => setMobileMenu(false)} aria-label="Tutup menu"><X size={19} /></button></div>
        <p className="nav-label">RUANG KERJA</p>
        <nav className="admin-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? 'active' : ''} aria-current={section === s.id ? 'page' : undefined} onClick={() => go(s.id)}>
              <s.icon size={19} /> {s.label}{s.id === 'partisipan' && view && <span>{view.patients.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-study"><span><ShieldCheck size={18} /></span><p><strong>Studi feasibility</strong><small>Data pseudonim · hanya kode partisipan</small></p></div>
        <button className="account-row" onClick={onLogout}><span className="avatar">{me.code.slice(0, 3)}</span><span><strong>{me.code}</strong><small>Peneliti · Keluar</small></span><LogOut size={17} /></button>
      </aside>
      {mobileMenu && <button className="sidebar-overlay" aria-label="Tutup menu" onClick={() => setMobileMenu(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Buka menu"><Menu size={21} /></button>
          <div><h1>{meta.label}</h1><p>Dashboard peneliti · {formatFullDate(today)}</p></div>
          <div className="admin-actions">
            <button className="icon-button" aria-label="Muat ulang" title="Muat ulang" onClick={reloadAll}><RefreshCw size={17} /></button>
            <button className="icon-button" aria-label="Keluar" title="Keluar" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </header>
        <div className="admin-content">
          <section className="admin-welcome">
            <div>
              <p className="eyebrow">{meta.eyebrow}</p>
              <h2>{meta.label}</h2>
              <p>{meta.usesFilters ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}${filters.code ? ` · partisipan ${filters.code}` : ' · semua partisipan'}` : meta.description}</p>
            </div>
            {meta.usesFilters && (
              <form className="filter-row" onSubmit={apply}>
                <select aria-label="Rentang cepat" value="" onChange={(e) => e.target.value && preset(Number(e.target.value))}>
                  <option value="">Rentang cepat…</option><option value="1">Hari ini</option><option value="7">7 hari terakhir</option><option value="14">14 hari terakhir</option><option value="30">30 hari terakhir</option>
                </select>
                <input type="date" aria-label="Dari tanggal" value={form.from} max={form.to} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
                <input type="date" aria-label="Sampai tanggal" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
                <input aria-label="Kode partisipan" placeholder="Kode, mis. P001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <button type="submit">Terapkan</button>
              </form>
            )}
          </section>

          {meta.usesFilters && error && <Notice kind="error">{error}</Notice>}
          {renderSection()}
          {meta.usesFilters && <p className="admin-footnote"><ShieldCheck size={15} /> Analitik bersifat deskriptif, bukan inferensi klinis.</p>}
        </div>
      </main>
    </div>
  )
}
