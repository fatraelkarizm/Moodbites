import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseRelationships, PERSONAL_OPTIONS, RESEARCH_OPTIONS, type DayRow, type FoodCategory } from '../src/stats.js';

/** RNG sederhana agar data sintetis deterministik. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

/**
 * 15 partisipan x 7 hari. Efek yang ditanam:
 * - hari stres: mood -1
 * - gorengan hari ini: mood BESOK -1 (lag 1)
 * - tidur: +0.5 mood per jam di atas rata-rata
 * - sayur_buah: tidak ada efek
 * Setiap partisipan punya baseline mood berbeda (between-person) yang harus dinetralkan.
 */
function synthetic(): DayRow[] {
  const r = rng(42);
  const rows: DayRow[] = [];
  for (let p = 0; p < 15; p++) {
    const baseline = 2.5 + r() * 1.5;
    let friedYesterday = false;
    for (let d = 0; d < 7; d++) {
      const stressed = r() < 0.45;
      const sleepHours = 5 + r() * 4;
      const fried = r() < 0.5;
      const veg = r() < 0.5;
      const mood = baseline - (stressed ? 1 : 0) - (friedYesterday ? 1 : 0) + 0.5 * (sleepHours - 7) + (r() - 0.5) * 0.6;
      const categories: FoodCategory[] = ['karbo', ...(fried ? ['gorengan' as const] : []), ...(veg ? ['sayur_buah' as const] : [])];
      rows.push({ patientCode: `P${p}`, date: `2026-10-${String(10 + d).padStart(2, '0')}`, mood, stressed, sleepHours, sleepQuality: 3, categories });
      friedYesterday = fried;
    }
  }
  return rows;
}

const find = (findings: ReturnType<typeof analyseRelationships>, id: string) => {
  const f = findings.find((x) => x.id === id);
  assert.ok(f, `finding ${id} tidak ada`);
  return f;
};

test('mendeteksi efek stres terhadap mood secara within-person', () => {
  const f = find(analyseRelationships(synthetic(), RESEARCH_OPTIONS), 'stress->mood');
  assert.equal(f.verdict, 'lower');
  assert.ok(Math.abs(f.effect! + 1) < 0.35, `efek ${f.effect} seharusnya sekitar -1`);
  assert.ok(f.ciLow! < f.effect! && f.effect! < f.ciHigh!);
});

test('mendeteksi slope tidur terhadap mood', () => {
  const f = find(analyseRelationships(synthetic(), RESEARCH_OPTIONS), 'sleepHours->mood');
  assert.equal(f.verdict, 'higher');
  assert.ok(Math.abs(f.effect! - 0.5) < 0.2, `slope ${f.effect} seharusnya sekitar 0.5`);
});

test('efek makanan hari berikutnya hanya muncul dengan lag 1', () => {
  const lagged = find(analyseRelationships(synthetic(), { ...RESEARCH_OPTIONS, lagFood: 1 }), 'gorengan->mood@lag1');
  assert.equal(lagged.verdict, 'lower');
  const veg = find(analyseRelationships(synthetic(), { ...RESEARCH_OPTIONS, lagFood: 1 }), 'sayur_buah->mood@lag1');
  assert.notEqual(veg.verdict, 'lower');
  assert.notEqual(veg.verdict, 'higher');
});

test('data terlalu sedikit menghasilkan status insufficient, bukan kesimpulan', () => {
  const rows = synthetic().filter((r) => r.patientCode === 'P0').slice(0, 3);
  const findings = analyseRelationships(rows, PERSONAL_OPTIONS);
  assert.ok(findings.every((f) => f.verdict === 'insufficient'));
});

test('kategori tanpa catatan makan tidak dihitung sebagai "tidak makan"', () => {
  const rows: DayRow[] = [0, 1, 2, 3, 4, 5].map((d) => ({
    patientCode: 'P1', date: `2026-10-1${d}`, mood: 3, stressed: false, sleepHours: null, sleepQuality: null, categories: [],
  }));
  const f = find(analyseRelationships(rows, PERSONAL_OPTIONS), 'gorengan->mood');
  assert.equal(f.nDays, 0);
  assert.equal(f.verdict, 'insufficient');
});
