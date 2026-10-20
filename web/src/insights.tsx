import { useState } from 'react'
import { moodOptions } from './data'
import type { Finding, InsightDay } from './lib/api'
import { formatShortDate, formatWeekday } from './lib/date'
import { categoryMeta, effectUnit, formatEffect, displayEffect, relationLabel, researchSentence } from './lib/insights'

const moodOf = (v: number | null) => (v === null ? undefined : moodOptions.find((o) => o.value === Math.round(v)))

/**
 * Timeline terhubung: mood, stres, tidur, dan makan berbagi sumbu hari yang sama.
 * Mengetuk/mengarahkan ke satu hari menyorot kolom tersebut di semua baris dan menampilkan detailnya.
 */
export function LinkedTimeline({ dates, days }: { dates: string[]; days: InsightDay[] }) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const [active, setActive] = useState<string | null>(dates.at(-1) ?? null)
  const sel = active ? byDate.get(active) : undefined
  const selMood = moodOf(sel?.mood ?? null)
  const cols = { gridTemplateColumns: `50px repeat(${dates.length}, minmax(31px, 1fr))` }

  const cell = (date: string, children: React.ReactNode, label: string) => (
    <button type="button" key={date} className={`tl-cell${active === date ? ' active' : ''}`} onClick={() => setActive(date)} onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(date)} aria-label={label}>
      {children}
    </button>
  )

  return (
    <div className="timeline">
      <div className="tl-scroll">
        <div className="tl-grid" style={cols}>
          <span className="tl-label" />
          {dates.map((d) => <span key={d} className={`tl-day${active === d ? ' active' : ''}`}>{formatWeekday(d)}<small>{formatShortDate(d).split(' ')[0]}</small></span>)}

          <span className="tl-label">Emosi</span>
          {dates.map((d) => {
            const row = byDate.get(d), m = moodOf(row?.mood ?? null)
            return cell(d, m ? <span className="tl-bar-wrap"><span className="tl-bar" style={{ height: `${(row!.mood! / 5) * 100}%`, background: m.color }} /><b>{row!.mood! % 1 ? row!.mood!.toFixed(1) : row!.mood}</b></span> : <span className="tl-empty">–</span>,
              `${formatShortDate(d)} mood ${m ? `${row!.mood} ${m.label}` : 'tidak dicatat'}`)
          })}

          <span className="tl-label">Stres</span>
          {dates.map((d) => {
            const s = byDate.get(d)?.stressed
            return cell(d, s === null || s === undefined ? <span className="tl-empty">–</span> : <span className={`tl-stress ${s ? 'yes' : 'no'}`}>{s ? 'Ya' : 'Tdk'}</span>,
              `${formatShortDate(d)} stres ${s === null || s === undefined ? 'tidak dicatat' : s ? 'ya' : 'tidak'}`)
          })}

          <span className="tl-label">Tidur</span>
          {dates.map((d) => {
            const h = byDate.get(d)?.sleepHours ?? null
            return cell(d, h === null ? <span className="tl-empty">–</span> : <span className="tl-bar-wrap"><span className="tl-bar sleep" style={{ height: `${Math.min(1, h / 12) * 100}%` }} /><b>{h % 1 ? h.toFixed(1) : h}</b></span>,
              `${formatShortDate(d)} tidur ${h === null ? 'tidak dicatat' : `${h} jam`}`)
          })}

          <span className="tl-label">Makan</span>
          {dates.map((d) => {
            const cats = byDate.get(d)?.categories ?? []
            return cell(d, cats.length ? <span className="tl-food">{cats.map((c) => <span key={c} title={categoryMeta[c].short}>{categoryMeta[c].icon}</span>)}</span> : <span className="tl-empty">–</span>,
              `${formatShortDate(d)} makan ${cats.length ? cats.map((c) => categoryMeta[c].short).join(', ') : 'tidak dicatat'}`)
          })}
        </div>
      </div>
      {active && (
        <p className="tl-detail" aria-live="polite">
          <strong>{formatWeekday(active)}, {formatShortDate(active)}</strong>
          {' · '}Emosi {selMood ? `${sel!.mood} ${selMood.label}` : '–'}
          {' · '}Stres {sel?.stressed === null || sel?.stressed === undefined ? '–' : sel.stressed ? 'ya' : 'tidak'}
          {' · '}Tidur {sel?.sleepHours ?? '–'}{sel?.sleepHours !== null && sel?.sleepHours !== undefined ? ' jam' : ''}
          {' · '}Makan {sel?.categories.length ? sel.categories.map((c) => categoryMeta[c].short).join(', ') : '–'}
        </p>
      )}
      <p className="tl-legend">Emosi: 0 senang · 1 baik · 2 cemas · 3 sedih · 4 kesal · 5 marah sekali<br />🍚 karbo · 🍤 gorengan · 🍰 manis · 🥦 sayur/buah · 🍗 protein · 🧋 minuman manis · 🍽️ lainnya</p>
    </div>
  )
}

const verdictLabel: Record<Finding['verdict'], string> = {
  higher: 'Terlihat ↑', lower: 'Terlihat ↓', unclear: 'Belum jelas', insufficient: 'Data kurang',
}

/**
 * Forest plot: titik = perkiraan efek within-person, garis = 95% CI, garis tegak = tidak ada efek.
 * Satu tabel per satuan (mood dalam poin, stres dalam poin persen) agar sumbunya tidak bercampur.
 */
export function ForestTable({ findings: all, title, caption }: { findings: Finding[]; title: string; caption: string }) {
  // Prediktor tanpa variasi (mis. selalu/tidak pernah dimakan) tidak bisa dinilai; disebut di catatan saja.
  const findings = all.filter((f) => f.nPatients > 0)
  const skipped = all.filter((f) => f.nPatients === 0)
  const tested = findings.filter((f) => f.ciLow !== null && f.ciHigh !== null)
  const extent = Math.max(0.5, ...tested.flatMap((f) => [Math.abs(displayEffect(f, f.ciLow!)), Math.abs(displayEffect(f, f.ciHigh!))]))
  const pos = (f: Finding, v: number) => `${50 + (displayEffect(f, v) / extent) * 50}%`
  return (
    <div className="forest">
      <div className="panel-title"><div><h3>{title}</h3><p>{caption}</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Hubungan</th><th className="forest-axis-head"><span>−{extent.toFixed(extent < 5 ? 1 : 0)}</span><span>0</span><span>+{extent.toFixed(extent < 5 ? 1 : 0)}</span></th><th>Efek ({findings[0] ? effectUnit(findings[0]) : ''})</th><th>95% CI</th><th>Data</th><th>Kesimpulan</th></tr></thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.id} title={researchSentence(f)}>
                <td>{relationLabel(f)}</td>
                <td className="forest-cell"><div className="forest-track">
                  <span className="forest-zero" />
                  {f.ciLow !== null && f.ciHigh !== null && f.effect !== null && (
                    <>
                      <span className={`forest-ci ${f.verdict}`} style={{ left: pos(f, Math.min(f.ciLow, f.ciHigh)), right: `calc(100% - ${pos(f, Math.max(f.ciLow, f.ciHigh))})` }} />
                      <span className={`forest-dot ${f.verdict}`} style={{ left: pos(f, f.effect) }} />
                    </>
                  )}
                </div></td>
                <td>{formatEffect(f, f.effect)}</td>
                <td>{f.ciLow === null ? '–' : `${formatEffect(f, f.ciLow)} s/d ${formatEffect(f, f.ciHigh)}`}</td>
                <td>{f.nDays} hari · {f.nPatients} org</td>
                <td><span className={`status ${f.verdict === 'higher' || f.verdict === 'lower' ? 'good' : 'neutral'}`}>{verdictLabel[f.verdict]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skipped.length > 0 && <p className="forest-skipped">Tidak dapat dinilai karena tidak ada variasi dalam data (selalu ada atau tidak pernah tercatat): {skipped.map((f) => relationLabel(f).split(' →')[0]).join(', ')}.</p>}
    </div>
  )
}
