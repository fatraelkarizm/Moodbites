import type { FoodCategory, Finding } from './api'

export const categoryMeta: Record<FoodCategory, { short: string; icon: string }> = {
  karbo: { short: 'Karbohidrat', icon: '🍚' },
  gorengan: { short: 'Gorengan', icon: '🍤' },
  manis: { short: 'Makanan manis', icon: '🍰' },
  sayur_buah: { short: 'Sayur/buah', icon: '🥦' },
  protein: { short: 'Protein', icon: '🍗' },
  minuman_manis: { short: 'Minuman manis', icon: '🧋' },
  lainnya: { short: 'Lainnya', icon: '🍽️' },
}

const n1 = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

/** Skala efek untuk ditampilkan: stres dalam poin persen, mood dalam poin skala 1-5. */
export const displayEffect = (f: Finding, v: number) => (f.outcome === 'stressed' ? v * 100 : v)
export const effectUnit = (f: Finding) => (f.outcome === 'stressed' ? '% poin' : 'poin')
export const formatEffect = (f: Finding, v: number | null) => {
  if (v === null) return '–'
  const d = displayEffect(f, v)
  const text = f.outcome === 'stressed' ? Math.abs(d).toFixed(0) : n2(Math.abs(d))
  if (Number(text.replace(',', '.')) === 0) return '0'
  return `${d > 0 ? '+' : '−'}${text}`
}

/** Nama hubungan singkat, mis. "Gorengan → skor emosi (hari berikutnya)". */
export function relationLabel(f: Finding): string {
  const p = f.predictor
  const left = p.kind === 'stress' ? 'Merasa stres'
    : p.kind === 'sleepHours' ? 'Durasi tidur (per jam)'
    : p.kind === 'sleepQuality' ? 'Kualitas tidur (per poin)'
    : p.kind === 'mindfulness' ? 'Perhatian saat makan (per poin)'
    : categoryMeta[p.category].short
  const right = f.outcome === 'mood' ? 'skor emosi' : 'merasa stres'
  return `${left} → ${right}${f.lag ? ' (hari berikutnya)' : ''}`
}

function predictorPhrase(f: Finding, personal: boolean): string {
  const p = f.predictor
  const kamu = personal ? 'kamu ' : 'partisipan '
  if (p.kind === 'stress') return `di hari ${kamu}merasa stres`
  if (p.kind === 'category') {
    const food = categoryMeta[p.category].short.toLowerCase()
    return f.lag ? `sehari setelah ${kamu}makan ${food}` : `di hari ${kamu}makan ${food}`
  }
  if (p.kind === 'mindfulness') return 'setiap kenaikan 1 poin perhatian saat makan'
  return p.kind === 'sleepHours' ? 'setiap tambahan 1 jam tidur' : 'setiap kenaikan 1 poin kualitas tidur'
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Skor termometer emosi: 0 senang ... 5 marah sekali, jadi skor naik = emosi lebih berat. */
const moodMeaning = (higher: boolean) => (higher ? 'emosi lebih berat' : 'emosi lebih ringan')

/** Kalimat kesimpulan untuk peneliti, lengkap dengan CI dan jumlah data. */
export function researchSentence(f: Finding): string {
  const pred = predictorPhrase(f, false)
  const ci = f.ciLow !== null && f.ciHigh !== null ? `95% CI ${formatEffect(f, f.ciLow)} s/d ${formatEffect(f, f.ciHigh)}` : ''
  const n = `${f.nDays} hari, ${f.nPatients} partisipan`
  if (f.verdict === 'insufficient') return `Data belum cukup untuk menilai hubungan ini (${n} yang informatif).`
  const size = f.effect === null ? '' : f.outcome === 'stressed' ? `${Math.abs(displayEffect(f, f.effect)).toFixed(0)} poin persen` : `${n2(Math.abs(f.effect))} poin`
  if (f.verdict === 'unclear') return `Belum terlihat hubungan yang jelas (perkiraan ${formatEffect(f, f.effect)} ${effectUnit(f)}; ${ci}; ${n}).`
  const dir = f.verdict === 'higher'
  if (f.type === 'slope') {
    const what = f.outcome === 'mood' ? 'skor termometer emosi' : 'peluang merasa stres'
    const meaning = f.outcome === 'mood' ? `, artinya ${moodMeaning(dir)}` : ''
    return `${capital(pred)}, ${what} rata-rata ${dir ? 'naik' : 'turun'} ${size}${meaning} (${ci}; ${n}).`
  }
  if (f.outcome === 'mood') {
    return `${capital(pred)}, skor termometer emosi rata-rata ${size} lebih ${dir ? 'tinggi' : 'rendah'} (${moodMeaning(dir)}) dibanding hari lainnya pada orang yang sama (${ci}; ${n}).`
  }
  return `${capital(pred)}, proporsi merasa stres ${size} lebih ${dir ? 'tinggi' : 'rendah'} dibanding hari lainnya pada orang yang sama (${ci}; ${n}).`
}

/** Kalimat sederhana untuk pasien (tanpa istilah statistik). */
export function personalSentence(f: Finding): string {
  const pred = predictorPhrase(f, true)
  const dir = f.verdict === 'higher'
  const feel = dir ? 'perasaanmu cenderung lebih berat' : 'perasaanmu cenderung lebih ringan'
  if (f.type === 'slope') {
    const what = f.predictor.kind === 'sleepHours' ? 'tidurmu lebih lama'
      : f.predictor.kind === 'mindfulness' ? 'kamu makan dengan lebih penuh perhatian'
      : 'kualitas tidurmu lebih baik'
    return f.outcome === 'mood'
      ? `Saat ${what}, ${feel}.`
      : `Saat ${what}, kamu cenderung ${dir ? 'lebih sering' : 'lebih jarang'} merasa stres.`
  }
  if (f.outcome === 'mood') {
    const detail = f.withMean !== null && f.withoutMean !== null ? ` (rata-rata ${n1(f.withMean)} dibanding ${n1(f.withoutMean)} di termometer emosi)` : ''
    return `${capital(pred)}, ${feel} dari biasanya${detail}.`
  }
  return `${capital(pred)}, kamu ${dir ? 'lebih sering' : 'lebih jarang'} merasa stres.`
}
