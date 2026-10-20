import type { FastifyInstance } from 'fastify';
import { authenticate, patientOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { jakartaDate, jakartaDateDaysAgo } from '../lib.js';

export async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history',{preHandler:[authenticate,patientOnly]},async(request)=>withAccount(request.account,async(c)=>{
    const [meals,moods,sleep]=await Promise.all([
      c.query(`select entry_date as "entryDate",json_agg(json_build_object('id',id,'mealType',meal_type,'eatenAt',eaten_at,'foodName',food_name,'foodCategory',food_category,'portionSize',portion_size,'servings',servings,'mindfulness',mindfulness) order by eaten_at) as entries from meal_entries where patient_id=$1 and entry_date between $2 and $3 group by entry_date`,[request.account.id,jakartaDateDaysAgo(6),jakartaDate()]),
      c.query(`select entry_date as "entryDate",json_agg(json_build_object('id',id,'mood',mood,'note',note,'isStressed',is_stressed,'stressCause',stress_cause) order by recorded_at) as entries from mood_entries where patient_id=$1 and entry_date between $2 and $3 group by entry_date`,[request.account.id,jakartaDateDaysAgo(6),jakartaDate()]),
      c.query(`select entry_date as "entryDate",duration_hours as "durationHours",quality,obstacle from sleep_entries where patient_id=$1 and entry_date between $2 and $3`,[request.account.id,jakartaDateDaysAgo(6),jakartaDate()]),
    ]); return {meals:meals.rows,moods:moods.rows,sleep:sleep.rows};
  }));
}
