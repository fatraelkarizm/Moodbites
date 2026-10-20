/**
 * Analisis hubungan makanan, tidur, stres, dan mood dari data harian (EMA/diary).
 *
 * Prinsip:
 * - Within-person: setiap partisipan dibandingkan dengan dirinya sendiri, lalu dirata-rata
 *   antar partisipan, sehingga perbedaan rata-rata antar orang tidak mengacaukan hasil.
 * - Ketidakpastian: interval kepercayaan 95% dengan bootstrap (cluster per partisipan bila
 *   >= 3 partisipan, per hari bila hanya satu partisipan).
 * - Banyak perbandingan: p-value bootstrap dikoreksi Benjamini-Hochberg (q).
 * - Hasil bersifat asosiasi observasional, bukan sebab-akibat.
 */

export const FOOD_CATEGORIES = ['karbo', 'gorengan', 'manis', 'sayur_buah', 'protein', 'minuman_manis', 'lainnya'] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface DayRow {
  patientCode: string;
  date: string;
  mood: number | null;
  stressed: boolean | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  categories: FoodCategory[];
  /** Rata-rata perhatian saat makan (1-5) pada hari itu */
  mindfulness?: number | null;
}

export type Predictor =
  | { kind: 'stress' }
  | { kind: 'sleepHours' }
  | { kind: 'sleepQuality' }
  | { kind: 'mindfulness' }
  | { kind: 'category'; category: FoodCategory };
export type Outcome = 'mood' | 'stressed';
export type Verdict = 'higher' | 'lower' | 'unclear' | 'insufficient';

export interface Finding {
  id: string;
  predictor: Predictor;
  outcome: Outcome;
  /** diff: selisih rata-rata (ada vs tidak ada); slope: perubahan outcome per 1 unit prediktor */
  type: 'diff' | 'slope';
  /** Lag 1 = prediktor hari ini terhadap outcome hari berikutnya */
  lag: 0 | 1;
  effect: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  p: number | null;
  q: number | null;
  nDays: number;
  nPatients: number;
  /** Untuk diff: rata-rata outcome (gabungan) pada hari dengan / tanpa prediktor */
  withMean: number | null;
  withN: number;
  withoutMean: number | null;
  withoutN: number;
  verdict: Verdict;
}

export interface AnalysisOptions {
  /** Minimal hari pada masing-masing kelompok (ada / tidak ada) */
  minDaysPerGroup: number;
  /** Minimal partisipan yang berkontribusi (mode multi-partisipan) */
  minPatients: number;
  /** Minimal pasangan hari untuk slope */
  minDaysSlope: number;
  iterations: number;
  alpha: number;
  lagFood: 0 | 1;
}

export const RESEARCH_OPTIONS: AnalysisOptions = { minDaysPerGroup: 5, minPatients: 3, minDaysSlope: 10, iterations: 2000, alpha: 0.05, lagFood: 0 };
export const PERSONAL_OPTIONS: AnalysisOptions = { minDaysPerGroup: 2, minPatients: 1, minDaysSlope: 4, iterations: 2000, alpha: 0.05, lagFood: 0 };

/** RNG deterministik agar hasil sama setiap kali halaman dimuat. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Satu pasangan pengamatan (x, y) untuk satu partisipan pada satu hari. */
type Pair = { x: number; y: number };

function predictorValue(row: DayRow, p: Predictor): number | null {
  switch (p.kind) {
    case 'stress': return row.stressed === null ? null : row.stressed ? 1 : 0;
    case 'sleepHours': return row.sleepHours;
    case 'sleepQuality': return row.sleepQuality;
    case 'mindfulness': return row.mindfulness ?? null;
    // Kategori hanya bermakna bila hari itu ada catatan makan.
    case 'category': return row.categories.length ? (row.categories.includes(p.category) ? 1 : 0) : null;
  }
}

function outcomeValue(row: DayRow, o: Outcome): number | null {
  if (o === 'mood') return row.mood;
  return row.stressed === null ? null : row.stressed ? 1 : 0;
}

function pairsByPatient(rows: DayRow[], predictor: Predictor, outcome: Outcome, lag: 0 | 1): Map<string, Pair[]> {
  const index = new Map(rows.map((r) => [`${r.patientCode}|${r.date}`, r]));
  const out = new Map<string, Pair[]>();
  for (const r of rows) {
    const x = predictorValue(r, predictor);
    if (x === null) continue;
    const target = lag ? index.get(`${r.patientCode}|${nextDate(r.date)}`) : r;
    const y = target ? outcomeValue(target, outcome) : null;
    if (y === null) continue;
    const list = out.get(r.patientCode) ?? [];
    list.push({ x, y });
    out.set(r.patientCode, list);
  }
  return out;
}

/** Selisih within-person: mean(y | x=1) - mean(y | x=0) per partisipan, dirata-rata antar partisipan. */
function diffEstimate(groups: Pair[][]): number {
  const diffs: number[] = [];
  for (const g of groups) {
    const a = g.filter((p) => p.x === 1).map((p) => p.y);
    const b = g.filter((p) => p.x === 0).map((p) => p.y);
    if (a.length && b.length) diffs.push(mean(a) - mean(b));
  }
  return diffs.length ? mean(diffs) : NaN;
}

/** Slope within-person: x dan y dipusatkan pada rata-rata tiap partisipan, lalu regresi gabungan. */
function slopeEstimate(groups: Pair[][]): number {
  let sxy = 0, sxx = 0;
  for (const g of groups) {
    if (g.length < 2) continue;
    const mx = mean(g.map((p) => p.x)), my = mean(g.map((p) => p.y));
    for (const p of g) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
  }
  return sxx > 0 ? sxy / sxx : NaN;
}

function bootstrap(groups: Pair[][], estimator: (g: Pair[][]) => number, iterations: number, seed: number, byPatient: boolean): number[] {
  const rand = mulberry32(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    // Cluster bootstrap: ambil ulang partisipan. Satu partisipan: ambil ulang hari di dalam tiap kelompok x.
    const sample = byPatient
      ? groups.map(() => pick(groups))
      : groups.map((g) => {
          const a = g.filter((p) => p.x === 1), b = g.filter((p) => p.x === 0);
          return a.length && b.length ? [...a.map(() => pick(a)), ...b.map(() => pick(b))] : g.map(() => pick(g));
        });
    const est = estimator(sample);
    if (Number.isFinite(est)) samples.push(est);
  }
  return samples.sort((a, b) => a - b);
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function analyse(rows: DayRow[], predictor: Predictor, outcome: Outcome, lag: 0 | 1, opts: AnalysisOptions): Finding {
  const type = predictor.kind === 'sleepHours' || predictor.kind === 'sleepQuality' || predictor.kind === 'mindfulness' ? 'slope' : 'diff';
  const id = `${predictor.kind === 'category' ? predictor.category : predictor.kind}->${outcome}${lag ? '@lag1' : ''}`;
  const byPatient = pairsByPatient(rows, predictor, outcome, lag);
  const all = [...byPatient.values()].flat();
  const withVals = all.filter((p) => p.x === 1).map((p) => p.y);
  const withoutVals = all.filter((p) => p.x === 0).map((p) => p.y);

  // Hanya partisipan yang punya variasi pada prediktor yang memberi informasi within-person.
  const informative = [...byPatient.values()].filter((g) =>
    type === 'diff' ? g.some((p) => p.x === 1) && g.some((p) => p.x === 0) : new Set(g.map((p) => p.x)).size > 1);
  const informativeDays = informative.flat();
  const base: Finding = {
    id, predictor, outcome, type, lag,
    effect: null, ciLow: null, ciHigh: null, p: null, q: null,
    nDays: informativeDays.length, nPatients: informative.length,
    withMean: type === 'diff' && withVals.length ? mean(withVals) : null, withN: type === 'diff' ? withVals.length : 0,
    withoutMean: type === 'diff' && withoutVals.length ? mean(withoutVals) : null, withoutN: type === 'diff' ? withoutVals.length : 0,
    verdict: 'insufficient',
  };

  const enough = type === 'diff'
    ? informativeDays.filter((p) => p.x === 1).length >= opts.minDaysPerGroup && informativeDays.filter((p) => p.x === 0).length >= opts.minDaysPerGroup
    : informativeDays.length >= opts.minDaysSlope;
  if (!enough || informative.length < opts.minPatients) return base;

  const estimator = type === 'diff' ? diffEstimate : slopeEstimate;
  const effect = estimator(informative);
  if (!Number.isFinite(effect)) return base;
  const clusterByPatient = informative.length >= 3;
  const samples = bootstrap(informative, estimator, opts.iterations, hashSeed(id), clusterByPatient);
  if (samples.length < opts.iterations / 2) return base;
  const below = samples.filter((s) => s <= 0).length / samples.length;
  const above = samples.filter((s) => s >= 0).length / samples.length;
  const p = Math.min(1, 2 * Math.min(below, above));
  return {
    ...base, effect,
    ciLow: quantile(samples, opts.alpha / 2), ciHigh: quantile(samples, 1 - opts.alpha / 2),
    p: Math.max(p, 1 / samples.length),
  };
}

/** Koreksi Benjamini-Hochberg lalu tentukan kesimpulan. */
function finalize(findings: Finding[], alpha: number): Finding[] {
  const tested = findings.filter((f) => f.p !== null).sort((a, b) => a.p! - b.p!);
  const m = tested.length;
  let prev = 1;
  for (let i = m - 1; i >= 0; i--) {
    const f = tested[i]!;
    prev = Math.min(prev, (f.p! * m) / (i + 1));
    f.q = prev;
  }
  return findings.map((f) => {
    if (f.effect === null || f.q === null) return f;
    const excludesZero = (f.ciLow! > 0 && f.ciHigh! > 0) || (f.ciLow! < 0 && f.ciHigh! < 0);
    const verdict: Verdict = excludesZero && f.q < alpha ? (f.effect > 0 ? 'higher' : 'lower') : 'unclear';
    return { ...f, verdict };
  });
}

export function analyseRelationships(rows: DayRow[], opts: AnalysisOptions): Finding[] {
  const lag = opts.lagFood;
  const findings: Finding[] = [
    analyse(rows, { kind: 'stress' }, 'mood', 0, opts),
    analyse(rows, { kind: 'sleepHours' }, 'mood', 0, opts),
    analyse(rows, { kind: 'sleepQuality' }, 'mood', 0, opts),
    analyse(rows, { kind: 'sleepHours' }, 'stressed', 0, opts),
    analyse(rows, { kind: 'mindfulness' }, 'mood', 0, opts),
    analyse(rows, { kind: 'mindfulness' }, 'stressed', 0, opts),
    ...FOOD_CATEGORIES.flatMap((category) => [
      analyse(rows, { kind: 'category', category }, 'mood', lag, opts),
      analyse(rows, { kind: 'category', category }, 'stressed', lag, opts),
    ]),
  ];
  return finalize(findings, opts.alpha);
}
