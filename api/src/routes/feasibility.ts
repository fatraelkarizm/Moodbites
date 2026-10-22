import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, patientOnly, researcherOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { assertAllowedEntryDate, dateSchema, jakartaDate } from '../lib.js';
import { dayCheckSchema, feedbackSchema } from '../schemas.js';

/** Jumlah hari studi per partisipan (PRD: 7 hari pemakaian). */
export const STUDY_DAYS = 7;
/** Kuesioner akhir muncul mulai hari studi ke-6 agar sempat diisi sebelum studi selesai. */
const FEEDBACK_FROM_DAY = 6;

/** Hari yang memiliki catatan apa pun; dipakai untuk menentukan hari pertama studi tiap partisipan. */
export const ACTIVE_DAYS_SQL = `select patient_id, entry_date from mood_entries
  union select patient_id, entry_date from sleep_entries
  union select patient_id, entry_date from meal_entries`;

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
};

export async function feasibilityRoutes(app: FastifyInstance): Promise<void> {
  const patient = [authenticate, patientOnly];

  app.get('/api/day-check', { preHandler: patient }, async (request) => {
    const { date } = z.object({ date: dateSchema }).parse(request.query);
    return withAccount(request.account, async (c) => {
      const r = await c.query<{ mealsComplete: boolean }>(
        'select meals_complete as "mealsComplete" from day_checks where patient_id=$1 and entry_date=$2', [request.account.id, date]);
      return { mealsComplete: r.rows[0]?.mealsComplete ?? null };
    });
  });

  app.put('/api/day-check', { preHandler: patient }, async (request) => {
    const body = dayCheckSchema.parse(request.body);
    assertAllowedEntryDate(body.entryDate);
    return withAccount(request.account, async (c) => (await c.query(
      `insert into day_checks(patient_id,entry_date,meals_complete) values($1,$2,$3)
       on conflict(patient_id,entry_date) do update set meals_complete=excluded.meals_complete, updated_at=now()
       returning meals_complete as "mealsComplete"`, [request.account.id, body.entryDate, body.mealsComplete])).rows[0]);
  });

  app.get('/api/feedback', { preHandler: patient }, async (request) => withAccount(request.account, async (c) => {
    const first = await c.query<{ d0: string | null }>(`select min(entry_date) as d0 from (${ACTIVE_DAYS_SQL}) d where patient_id=$1`, [request.account.id]);
    const d0 = first.rows[0]?.d0 ?? null;
    const studyDay = d0 ? Math.floor((Date.parse(jakartaDate()) - Date.parse(d0)) / 86_400_000) + 1 : 0;
    const fb = await c.query(
      `select ease, barriers, barriers_other as "barriersOther", suggestion, updated_at as "updatedAt"
       from study_feedback where patient_id=$1`, [request.account.id]);
    return { studyDay, eligible: studyDay >= FEEDBACK_FROM_DAY, feedback: fb.rows[0] ?? null };
  }));

  app.put('/api/feedback', { preHandler: patient }, async (request) => {
    const f = feedbackSchema.parse(request.body);
    return withAccount(request.account, async (c) => (await c.query(
      `insert into study_feedback(patient_id,ease,barriers,barriers_other,suggestion) values($1,$2,$3,$4,$5)
       on conflict(patient_id) do update set ease=excluded.ease, barriers=excluded.barriers,
         barriers_other=excluded.barriers_other, suggestion=excluded.suggestion, updated_at=now()
       returning ease`,
      [request.account.id, f.ease, f.barriers, f.barriers.includes('lainnya') ? f.barriersOther?.trim() || null : null, f.suggestion?.trim() || null])).rows[0]);
  });

  /** Kriteria keberhasilan PRD bagian 11, dihitung atas seluruh studi (tidak terpengaruh filter tanggal). */
  app.get('/api/admin/feasibility', { preHandler: [authenticate, researcherOnly] }, async (request) => withAccount(request.account, async (c) => {
    const [completion, fill, feedback, totals] = await Promise.all([
      c.query<{ code: string; completeDays: number; activeDays: number; elapsedDays: number }>(
        `with days as (${ACTIVE_DAYS_SQL}),
         first as (select patient_id, min(entry_date) d0 from days group by patient_id),
         grid as (select f.patient_id, (f.d0 + g)::date d from first f cross join generate_series(0, $1 - 1) g),
         flags as (
           select g.patient_id, g.d <= $2::date as elapsed,
             exists(select 1 from meal_entries m where m.patient_id=g.patient_id and m.entry_date=g.d) as meal,
             exists(select 1 from mood_entries m where m.patient_id=g.patient_id and m.entry_date=g.d) as mood,
             exists(select 1 from sleep_entries s where s.patient_id=g.patient_id and s.entry_date=g.d) as sleep
           from grid g)
         select a.code,
           count(*) filter (where meal and mood and sleep)::int as "completeDays",
           count(*) filter (where meal or mood or sleep)::int as "activeDays",
           count(*) filter (where elapsed)::int as "elapsedDays"
         from flags f join accounts a on a.id=f.patient_id where a.role='patient' and a.excluded_at is null
         group by a.code order by a.code`, [STUDY_DAYS, jakartaDate()]),
      c.query<{ seconds: number }>(
        `select sum(x.s)::int as seconds from (
           select patient_id, entry_date, fill_seconds s from mood_entries
           union all select patient_id, entry_date, fill_seconds from meal_entries
           union all select patient_id, entry_date, fill_seconds from sleep_entries) x
         join accounts a on a.id=x.patient_id
         where a.role='patient' and a.excluded_at is null
         group by x.patient_id, x.entry_date having sum(x.s) > 0`),
      c.query<{ ease: number; barriers: string[]; barriersOther: string | null; suggestion: string | null; code: string }>(
        `select f.ease, f.barriers, f.barriers_other as "barriersOther", f.suggestion, a.code
         from study_feedback f join accounts a on a.id=f.patient_id
         where a.role='patient' and a.excluded_at is null order by a.code`),
      c.query<{ n: number }>(`select count(*)::int n from accounts where role='patient' and excluded_at is null`),
    ]);
    const seconds = fill.rows.map((r) => r.seconds).sort((a, b) => a - b);
    const barrierCounts: Record<string, number> = {};
    for (const f of feedback.rows) for (const b of f.barriers) barrierCounts[b] = (barrierCounts[b] ?? 0) + 1;
    const rows = completion.rows;
    return {
      studyDays: STUDY_DAYS,
      patientsTotal: totals.rows[0]?.n ?? 0,
      patientsStarted: rows.length,
      finishedComplete: rows.filter((r) => r.completeDays === STUDY_DAYS).length,
      finishedActive: rows.filter((r) => r.activeDays === STUDY_DAYS).length,
      inProgress: rows.filter((r) => r.elapsedDays < STUDY_DAYS).length,
      perPatient: rows,
      fillTime: {
        patientDays: seconds.length,
        medianSeconds: quantile(seconds, 0.5),
        p25Seconds: quantile(seconds, 0.25),
        p75Seconds: quantile(seconds, 0.75),
        meanSeconds: seconds.length ? seconds.reduce((a, b) => a + b, 0) / seconds.length : null,
      },
      feedback: {
        responses: feedback.rows.length,
        easeMean: feedback.rows.length ? feedback.rows.reduce((a, f) => a + f.ease, 0) / feedback.rows.length : null,
        ease: [1, 2, 3, 4, 5].map((v) => ({ ease: v, count: feedback.rows.filter((f) => f.ease === v).length })),
        barriers: Object.entries(barrierCounts).map(([barrier, count]) => ({ barrier, count })).sort((a, b) => b.count - a.count),
        comments: feedback.rows.filter((f) => f.suggestion || f.barriersOther)
          .map((f) => ({ patientCode: f.code, barriersOther: f.barriersOther, suggestion: f.suggestion })),
      },
    };
  }));
}
