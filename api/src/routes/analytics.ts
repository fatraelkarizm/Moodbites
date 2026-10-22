import type { FastifyInstance } from 'fastify';
import { authenticate, researcherOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { analyticsQuerySchema } from '../schemas.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/analytics', { preHandler: [authenticate, researcherOnly] }, async (request) => {
    const q = analyticsQuerySchema.parse(request.query);
    return withAccount(request.account, async (c) => {
      const args = [q.from, q.to, q.patientCode ?? null];
      const filter = `a.role='patient' and a.excluded_at is null and ($3::text is null or upper(a.code)=upper($3))`;
      const [completion, moodDistribution, sleepDistribution, mealDistribution, categoryDistribution, stressDistribution, trend] = await Promise.all([
        c.query(`with dates as (select generate_series($1::date,$2::date,'1 day')::date d), patients as
          (select a.id,a.code from accounts a where ${filter})
          select p.code as "patientCode",d.d as date,
          exists(select 1 from meal_entries m where m.patient_id=p.id and m.entry_date=d.d) as "hasMeal",
          exists(select 1 from mood_entries m where m.patient_id=p.id and m.entry_date=d.d) as "hasMood",
          exists(select 1 from sleep_entries s where s.patient_id=p.id and s.entry_date=d.d) as "hasSleep"
          from patients p cross join dates d order by d.d,p.code`, args),
        c.query(`select m.mood,count(*)::int as count from mood_entries m join accounts a on a.id=m.patient_id
          where m.entry_date between $1 and $2 and ${filter} group by m.mood order by m.mood`, args),
        c.query(`select s.quality,count(*)::int as count from sleep_entries s join accounts a on a.id=s.patient_id
          where s.entry_date between $1 and $2 and ${filter} group by s.quality order by s.quality`, args),
        c.query(`select m.meal_type as "mealType",count(*)::int as count from meal_entries m join accounts a on a.id=m.patient_id
          where m.entry_date between $1 and $2 and ${filter} group by m.meal_type order by m.meal_type`, args),
        c.query(`select m.food_category as "foodCategory",count(*)::int as count from meal_entries m join accounts a on a.id=m.patient_id
          where m.entry_date between $1 and $2 and ${filter} group by m.food_category order by count desc`, args),
        c.query(`select m.is_stressed as "isStressed",count(*)::int as count from mood_entries m join accounts a on a.id=m.patient_id
          where m.entry_date between $1 and $2 and ${filter} group by m.is_stressed order by m.is_stressed`, args),
        c.query(`with days as (select generate_series($1::date,$2::date,'1 day')::date d),
          mood_daily as (select m.entry_date,avg(m.mood) avg_mood,count(*) checkins,count(*) filter(where m.is_stressed) stressed
            from mood_entries m join accounts a on a.id=m.patient_id where m.entry_date between $1 and $2 and ${filter} group by m.entry_date),
          sleep_daily as (select s.entry_date,avg(s.quality) avg_quality,avg(s.duration_hours) avg_hours
            from sleep_entries s join accounts a on a.id=s.patient_id where s.entry_date between $1 and $2 and ${filter} group by s.entry_date)
          select d.d as date,round(md.avg_mood,2)::float as "averageMood",coalesce(md.checkins,0)::int as "moodCheckins",round(sd.avg_quality,2)::float as "averageSleepQuality",
          round(sd.avg_hours,2)::float as "averageSleepHours",coalesce(md.stressed,0)::int as "stressedCheckins"
          from days d left join mood_daily md on md.entry_date=d.d left join sleep_daily sd on sd.entry_date=d.d order by d.d`, args),
      ]);
      const days = completion.rows.length;
      const fullyComplete = completion.rows.filter((r) => r.hasMeal && r.hasMood && r.hasSleep).length;
      return {
        filters: q,
        summary: { patientDays: days, fullyComplete, completionRate: days ? Number((fullyComplete / days).toFixed(4)) : 0 },
        completion: completion.rows,
        distributions: { mood: moodDistribution.rows, sleepQuality: sleepDistribution.rows, mealType: mealDistribution.rows, foodCategory: categoryDistribution.rows, stressed: stressDistribution.rows },
        trend: trend.rows,
      };
    });
  });
}
