import { useEffect, useRef, useState } from 'react'
import { moodOptions, sleepOptions } from './data'
import type { History } from './lib/api'
import { formatShortDate, formatWeekday } from './lib/date'

type Value = number | null

/** Kurva halus monoton (Fritsch–Carlson) per segmen berurutan; hari tanpa data memutus garis. */
function smoothPath(points: Array<[number, number] | null>): string {
  let d = ''
  let seg: Array<[number, number]> = []
  const flush = () => {
    if (seg.length === 1) d += `M${seg[0]![0]},${seg[0]![1]}`
    if (seg.length > 1) {
      const n = seg.length
      const dx = seg.slice(1).map((p, i) => p[0] - seg[i]![0])
      const m = seg.slice(1).map((p, i) => (p[1] - seg[i]![1]) / dx[i]!)
      const t = seg.map((_, i) => (i === 0 ? m[0]! : i === n - 1 ? m[n - 2]! : m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2))
      d += `M${seg[0]![0]},${seg[0]![1]}`
      for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = seg[i]!, [x1, y1] = seg[i + 1]!, h = dx[i]! / 3
        d += `C${x0 + h},${y0 + t[i]! * h} ${x1 - h},${y1 - t[i + 1]! * h} ${x1},${y1}`
      }
    }
    seg = []
  }
  for (const p of points) { if (p) seg.push(p); else flush() }
  flush()
  return d
}

function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

interface ChartProps {
  dates: string[]
  values: Value[]
  domain: [number, number]
  ticks: number[]
  color: string
  label: string
  format: (v: number) => string
  kind?: 'line' | 'bar'
  pointColor?: (v: number) => string
  selected: number
  onSelect: (i: number) => void
}

/** Grafik satu seri, satu sumbu: garis halus atau batang, dengan hari terpilih yang disorot. */
function DayChart({ dates, values, domain, ticks, color, label, format, kind = 'line', pointColor, selected, onSelect }: ChartProps) {
  const [ref, W] = useWidth<SVGSVGElement>(320)
  const H = 170, L = 28, R = 10, T = 18, B = 24
  const n = dates.length
  const band = (W - L - R) / n
  const x = (i: number) => L + band * i + band / 2
  const y = (v: number) => T + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - T - B)
  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)] as [number, number]))

  return (
    <svg ref={ref} className="day-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      onPointerDown={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (r) onSelect(Math.min(n - 1, Math.max(0, Math.floor((((e.clientX - r.left) / r.width) * W - L) / band))))
      }}>
      <rect x={L + band * selected} y={T - 10} width={band} height={H - T - B + 10} rx={8} className="day-chart-sel" />
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="gridline" /><text x={L - 7} y={y(t) + 3} textAnchor="end" className="axis-label">{t}</text></g>)}
      {dates.map((d, i) => <text key={d} x={x(i)} y={H - 6} textAnchor="middle" className={`axis-label${i === selected ? ' strong' : ''}`}>{formatWeekday(d)}</text>)}
      {kind === 'bar'
        ? values.map((v, i) => v !== null && v > 0 && (
          <g key={i}>
            <rect x={x(i) - Math.min(12, band * 0.28)} y={y(v)} width={Math.min(24, band * 0.56)} height={y(domain[0]) - y(v)} rx={4} fill={color} opacity={i === selected ? 1 : 0.75} />
            <text x={x(i)} y={y(v) - 5} textAnchor="middle" className="value-label">{v}</text>
          </g>))
        : <>
            <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={i === selected ? 6 : 4.5} fill={pointColor ? pointColor(values[i]!) : color} stroke="white" strokeWidth={2} />)}
          </>}
      {values[selected] !== null && kind === 'line' && <text x={x(selected)} y={Math.max(11, y(values[selected]!) - 11)} textAnchor="middle" className="value-label">{format(values[selected]!)}</text>}
    </svg>
  )
}

type Tab = 'makan' | 'emosi' | 'tidur' | 'stres'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'makan', label: 'Makan' }, { id: 'emosi', label: 'Emosi' }, { id: 'tidur', label: 'Tidur' }, { id: 'stres', label: 'Stres' },
]

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const one = (v: number | null) => (v === null ? '–' : v.toLocaleString('id-ID', { maximumFractionDigits: 1 }))

/** Grafik per kategori di halaman Riwayat (7 hari terakhir), seperti tab di prototype klien. */
export function CategoryCharts({ dates, history }: { dates: string[]; history: History }) {
  const [tab, setTab] = useState<Tab>('emosi')
  const [selected, setSelected] = useState(dates.length - 1)

  const meals = dates.map((d) => history.meals.find((m) => m.entryDate === d)?.entries ?? [])
  const mealCount = meals.map((m) => (m.length ? m.length : null))
  const mindful = meals.map((m) => mean(m.map((e) => e.mindfulness).filter((v): v is number => typeof v === 'number')))
  const moods = dates.map((d) => history.moods.find((m) => m.entryDate === d)?.entries.at(-1) ?? null)
  const mood = moods.map((m) => m?.mood ?? null)
  const sleep = dates.map((d) => history.sleep.find((s) => s.entryDate === d) ?? null)
  const sleepHours = sleep.map((s) => s?.durationHours ?? null)
  const sleepQuality = sleep.map((s) => s?.quality ?? null)
  const has = (vs: Value[]) => vs.some((v) => v !== null)
  const empty = <p className="chart-empty">Belum ada catatan pada 7 hari ini. Isi catatan harian untuk melihat grafiknya.</p>
  const day = dates[selected]!
  const common = { dates, selected, onSelect: setSelected }

  const detail = (() => {
    const d = `${formatWeekday(day)}, ${formatShortDate(day)}`
    switch (tab) {
      case 'makan': return `${d} · ${meals[selected]!.length} catatan makan · perhatian saat makan ${one(mindful[selected]!)}`
      case 'emosi': { const o = moodOptions.find((m) => m.value === mood[selected]); return `${d} · ${o ? `${o.value} · ${o.label}` : 'belum dicatat'}` }
      case 'tidur': { const q = sleepOptions.find((s) => s.value === sleepQuality[selected]); return `${d} · ${sleepHours[selected] === null ? 'belum dicatat' : `${one(sleepHours[selected]!)} jam · kualitas ${q ? `${q.value} (${q.label})` : '–'}`}` }
      case 'stres': { const m = moods[selected]; return `${d} · ${!m ? 'belum dicatat' : m.isStressed ? `merasa stres${m.stressCause ? ` · ${m.stressCause}` : ''}` : 'tidak merasa stres'}` }
    }
  })()

  return (
    <section className="form-card insight-card category-charts">
      <h3>Grafikmu per kategori</h3>
      <p className="insight-help">Lihat naik-turunnya catatanmu selama 7 hari. Ketuk satu hari untuk melihat nilainya.</p>
      <div className="segmented chart-tabs" role="tablist" aria-label="Kategori grafik">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'emosi' && (has(mood) ? <>
        <h4>Termometer emosi</h4>
        <DayChart {...common} values={mood} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} color="#6b6f80" label="Skor termometer emosi per hari, 0 senang sampai 5 marah sekali"
          format={(v) => moodOptions.find((o) => o.value === v)?.label ?? String(v)} pointColor={(v) => moodOptions.find((o) => o.value === v)?.color ?? '#6b6f80'} />
        <p className="chart-caption">0 senang · 1 baik · 2 cemas · 3 sedih · 4 kesal · 5 marah sekali. Makin tinggi, emosi makin berat.</p>
      </> : empty)}

      {tab === 'makan' && (has(mealCount) ? <>
        <h4>Jumlah catatan makan per hari</h4>
        <DayChart {...common} kind="bar" values={mealCount} domain={[0, Math.max(4, ...mealCount.map((v) => v ?? 0))]} ticks={[0, 2, 4]} color="#4d9187" label="Jumlah catatan makan per hari" format={String} />
        {has(mindful) && <>
          <h4>Perhatian saat makan (rata-rata 1–5)</h4>
          <DayChart {...common} values={mindful} domain={[1, 5]} ticks={[1, 3, 5]} color="#b07a3e" label="Rata-rata perhatian saat makan per hari, skala 1 sampai 5" format={(v) => one(v)} />
        </>}
      </> : empty)}

      {tab === 'tidur' && (has(sleepHours) ? <>
        <h4>Durasi tidur (jam)</h4>
        <DayChart {...common} values={sleepHours} domain={[0, 12]} ticks={[0, 3, 6, 9, 12]} color="#3a78c2" label="Durasi tidur per hari dalam jam" format={(v) => `${one(v)} jam`} />
        <h4>Kualitas tidur (1–5)</h4>
        <DayChart {...common} values={sleepQuality} domain={[1, 5]} ticks={[1, 3, 5]} color="#2f6f68" label="Kualitas tidur per hari, 1 sangat buruk sampai 5 sangat baik" format={(v) => sleepOptions.find((s) => s.value === v)?.label ?? String(v)} />
      </> : empty)}

      {tab === 'stres' && (moods.some(Boolean) ? <>
        <h4>Merasa stres saat check-in</h4>
        <div className="stress-days" role="list">
          {dates.map((d, i) => {
            const m = moods[i]
            const state = !m ? 'none' : m.isStressed ? 'yes' : 'no'
            return (
              <button key={d} type="button" role="listitem" className={`stress-day ${state}${i === selected ? ' active' : ''}`} onClick={() => setSelected(i)}
                aria-label={`${formatShortDate(d)}: ${state === 'none' ? 'belum dicatat' : state === 'yes' ? 'merasa stres' : 'tidak stres'}`}>
                <span>{formatWeekday(d)}</span><b>{state === 'none' ? '–' : state === 'yes' ? 'Ya' : 'Tidak'}</b>
              </button>
            )
          })}
        </div>
        <p className="chart-caption">Merasa stres di {moods.filter((m) => m?.isStressed).length} dari {moods.filter(Boolean).length} hari yang tercatat.</p>
      </> : empty)}

      <p className="tl-detail" aria-live="polite">{detail}</p>
    </section>
  )
}
