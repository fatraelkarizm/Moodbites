import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { authenticate, patientOnly, researcherOnly } from '../auth.js';
import { loadConfig } from '../config.js';
import { withAccount } from '../db.js';
import { jakartaDate, jakartaDateDaysAgo } from '../lib.js';
import { analyticsQuerySchema } from '../schemas.js';
import { analyseRelationships, PERSONAL_OPTIONS, RESEARCH_OPTIONS, type DayRow } from '../stats.js';

const config = loadConfig();

/** Satu baris per partisipan per hari yang memiliki catatan apa pun. RLS tetap membatasi baris yang terlihat. */
async function loadDays(c: PoolClient, from: string, to: string, filter: { patientCode?: string | undefined; accountId?: string }): Promise<DayRow[]> {
  const result = await c.query<DayRow>(
    `with days as (
       select patient_id, entry_date from mood_entries
       union select patient_id, entry_date from sleep_entries
       union select patient_id, entry_date from meal_entries
     )
     select a.code as "patientCode", d.entry_date as date, mo.mood, mo.is_stressed as stressed,
       s.duration_hours::float as "sleepHours", s.quality as "sleepQuality",
       -- Hari yang ditandai "belum semua makan dicatat" tidak dipakai untuk analisis makanan.
       case when dc.meals_complete is false then '{}'::text[] else coalesce((select array_agg(distinct m.food_category order by m.food_category) from meal_entries m
         where m.patient_id = d.patient_id and m.entry_date = d.entry_date), '{}') end as categories,
       (select avg(m.mindfulness)::float from meal_entries m
         where m.patient_id = d.patient_id and m.entry_date = d.entry_date) as mindfulness
     from days d
     join accounts a on a.id = d.patient_id
     left join mood_entries mo on mo.patient_id = d.patient_id and mo.entry_date = d.entry_date
     left join sleep_entries s on s.patient_id = d.patient_id and s.entry_date = d.entry_date
     left join day_checks dc on dc.patient_id = d.patient_id and dc.entry_date = d.entry_date
     where a.role = 'patient' and a.excluded_at is null and d.entry_date between $1 and $2
       and ($3::text is null or upper(a.code) = upper($3))
       and ($4::uuid is null or a.id = $4)
     order by a.code, d.entry_date`,
    [from, to, filter.patientCode ?? null, filter.accountId ?? null],
  );
  return result.rows;
}

const lagSchema = z.object({ lag: z.enum(['0', '1']).default('0') });

export async function insightRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/insights', { preHandler: [authenticate, researcherOnly] }, async (request) => {
    const q = analyticsQuerySchema.parse(request.query);
    const { lag } = lagSchema.parse(request.query);
    return withAccount(request.account, async (c) => {
      const days = await loadDays(c, q.from, q.to, { patientCode: q.patientCode });
      // Satu partisipan terpilih: analisis personal (tanpa syarat minimal 3 partisipan).
      const opts = q.patientCode ? PERSONAL_OPTIONS : RESEARCH_OPTIONS;
      return {
        filters: { ...q, lag: Number(lag) },
        patients: new Set(days.map((d) => d.patientCode)).size,
        observedDays: days.length,
        findings: analyseRelationships(days, { ...opts, lagFood: lag === '1' ? 1 : 0 }),
        days: q.patientCode ? days : [],
      };
    });
  });

  app.get('/api/insights', { preHandler: [authenticate, patientOnly] }, async (request, reply) => {
    if (!config.PATIENT_INSIGHTS) return reply.code(404).send({ error: 'Fitur pola pribadi tidak diaktifkan' });
    return withAccount(request.account, async (c) => {
      // Pola dihitung dari seluruh catatan partisipan selama studi; timeline menampilkan 7 hari terakhir.
      const all = await loadDays(c, '2000-01-01', jakartaDate(), { accountId: request.account.id });
      const from = jakartaDateDaysAgo(6);
      return {
        days: all.filter((d) => d.date >= from),
        totalDays: all.length,
        findings: analyseRelationships(all, PERSONAL_OPTIONS),
      };
    });
  });
}
