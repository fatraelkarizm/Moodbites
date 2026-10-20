import type { FastifyInstance } from 'fastify';
import { authenticate, patientOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { assertAllowedEntryDate, jakartaDate, jakartaDateDaysAgo } from '../lib.js';
import { rangeQuerySchema, sleepSchema } from '../schemas.js';

export async function sleepRoutes(app: FastifyInstance): Promise<void> {
  const guard=[authenticate,patientOnly];
  app.get('/api/sleep',{preHandler:guard},async(request)=>{const q=rangeQuerySchema.parse(request.query);return withAccount(request.account,async(c)=>(await c.query(`select id,entry_date as "entryDate",duration_hours as "durationHours",quality,obstacle,created_at as "createdAt",updated_at as "updatedAt" from sleep_entries where patient_id=$1 and entry_date between $2::date and $3::date order by entry_date desc`,[request.account.id,q.from??jakartaDateDaysAgo(6),q.to??jakartaDate()])).rows);});
  app.put('/api/sleep',{preHandler:guard},async(request)=>{const s=sleepSchema.parse(request.body);assertAllowedEntryDate(s.entryDate);return withAccount(request.account,async(c)=>(await c.query(`insert into sleep_entries(patient_id,entry_date,duration_hours,quality,obstacle,fill_seconds) values($1,$2,$3,$4,$5,$6) on conflict(patient_id,entry_date) do update set fill_seconds=sleep_entries.fill_seconds+excluded.fill_seconds,duration_hours=excluded.duration_hours,quality=excluded.quality,obstacle=excluded.obstacle,updated_at=now() returning *`,[request.account.id,s.entryDate,s.durationHours,s.quality,s.obstacle??null,s.fillSeconds??0])).rows[0]);});
}
