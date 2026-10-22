import type { FastifyInstance } from 'fastify';
import { authenticate, researcherOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { toCsv } from '../lib.js';
import { ACTIVE_DAYS_SQL } from './feasibility.js';

const CATEGORIES = ['karbo', 'gorengan', 'manis', 'sayur_buah', 'protein', 'minuman_manis', 'lainnya'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const exports: Record<string,string> = {
  patient_profiles:`select a.code as patient_code,p.age,p.sex,p.weight_kg,p.height_cm,p.bmi,p.education,p.marital_status,p.occupation,p.income_group,p.diagnosis_duration_months,p.art_status,p.art_duration_months,p.art_regimen,p.adherence,p.cd4_category,p.viral_load_category,p.smoking,p.alcohol,p.has_complications,p.complications,p.has_treatment_side_effects,p.treatment_side_effects,k.consent_version,k.agreed_at as consent_at,p.updated_at from patient_profiles p join accounts a on a.id=p.patient_id left join consents k on k.patient_id=p.patient_id where a.excluded_at is null order by a.code`,
  meal_entries:`select a.code as patient_code,m.entry_date,m.meal_type,m.eaten_at,m.food_name,m.food_category,m.portion_size,m.servings,m.mindfulness,m.fill_seconds,m.input_source,m.photo_url,m.created_at,m.updated_at from meal_entries m join accounts a on a.id=m.patient_id where a.excluded_at is null order by a.code,m.entry_date,m.eaten_at`,
  mood_entries:`select a.code as patient_code,m.entry_date,m.recorded_at,m.mood,m.note,m.is_stressed,m.stress_cause,m.fill_seconds,m.updated_at from mood_entries m join accounts a on a.id=m.patient_id where a.excluded_at is null order by a.code,m.recorded_at`,
  // Gabungan per partisipan per hari (PRD bagian 8): satu baris = satu partisipan pada satu tanggal,
  // termasuk hari tanpa catatan di antara hari pertama dan hari ke-7 studinya agar data hilang terlihat.
  daily_summary: `with days as (${ACTIVE_DAYS_SQL}),
    first as (select patient_id, min(entry_date) d0, max(entry_date) d1 from days group by patient_id),
    grid as (select f.patient_id, f.d0, d::date as entry_date from first f
      cross join generate_series(f.d0, greatest(f.d1, f.d0 + 6), interval '1 day') d)
    select a.code as patient_code, g.entry_date, (g.entry_date - g.d0 + 1) as study_day,
      (mo.patient_id is not null and s.patient_id is not null and coalesce(ml.meal_count,0) > 0) as complete,
      mo.mood, case mo.mood when 0 then 'senang' when 1 then 'baik' when 2 then 'cemas' when 3 then 'sedih'
        when 4 then 'kesal' when 5 then 'marah_sekali' end as mood_label,
      (mo.mood >= 2) as negative_emotion, mo.note as mood_note, mo.recorded_at as mood_recorded_at,
      mo.is_stressed, mo.stress_cause,
      s.duration_hours as sleep_hours, s.quality as sleep_quality, s.obstacle as sleep_obstacle,
      coalesce(ml.meal_count,0) as meal_count,
      ${MEAL_TYPES.map((t) => `coalesce(ml.${t},0) as ${t}_count`).join(', ')},
      ${CATEGORIES.map((c) => `coalesce(ml.cat_${c},0) as cat_${c}`).join(', ')},
      ml.mindfulness_mean, ml.first_meal_at, ml.last_meal_at, dc.meals_complete,
      coalesce(mo.fill_seconds,0) + coalesce(s.fill_seconds,0) + coalesce(ml.fill_seconds,0) as fill_seconds
    from grid g
    join accounts a on a.id = g.patient_id
    left join mood_entries mo on mo.patient_id = g.patient_id and mo.entry_date = g.entry_date
    left join sleep_entries s on s.patient_id = g.patient_id and s.entry_date = g.entry_date
    left join day_checks dc on dc.patient_id = g.patient_id and dc.entry_date = g.entry_date
    left join (
      select patient_id, entry_date, count(*)::int as meal_count,
        ${MEAL_TYPES.map((t) => `count(*) filter (where meal_type='${t}')::int as ${t}`).join(', ')},
        ${CATEGORIES.map((c) => `count(*) filter (where food_category='${c}')::int as cat_${c}`).join(', ')},
        round(avg(mindfulness), 2) as mindfulness_mean, min(eaten_at) as first_meal_at, max(eaten_at) as last_meal_at,
        sum(fill_seconds)::int as fill_seconds
      from meal_entries group by patient_id, entry_date
    ) ml on ml.patient_id = g.patient_id and ml.entry_date = g.entry_date
    where a.role = 'patient' and a.excluded_at is null
    order by a.code, g.entry_date`,
  study_feedback: `select a.code as patient_code, f.ease, array_to_string(f.barriers, ';') as barriers, f.barriers_other, f.suggestion, f.created_at, f.updated_at
    from study_feedback f join accounts a on a.id=f.patient_id where a.excluded_at is null order by a.code`,
  sleep_entries:`select a.code as patient_code,s.entry_date,s.duration_hours,s.quality,s.obstacle,s.fill_seconds,s.created_at,s.updated_at from sleep_entries s join accounts a on a.id=s.patient_id where a.excluded_at is null order by a.code,s.entry_date`,
};

export async function exportRoutes(app:FastifyInstance):Promise<void>{
  app.get<{Params:{table:string}}>('/api/admin/export/:table.csv',{preHandler:[authenticate,researcherOnly]},async(request,reply)=>{
    const sql=exports[request.params.table]; if(!sql)return reply.code(404).send({error:'Tabel ekspor tidak tersedia'});
    const data=await withAccount(request.account,async(c)=>(await c.query(sql)).rows);
    return reply.header('Content-Type','text/csv; charset=utf-8').header('Content-Disposition',`attachment; filename="${request.params.table}.csv"`).send(toCsv(data));
  });
}
