import type { FastifyInstance } from 'fastify';
import { authenticate, patientOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { assertAllowedEntryDate, jakartaDate, jakartaDateDaysAgo } from '../lib.js';
import { idParamsSchema, moodCreateSchema, moodPatchSchema, rangeQuerySchema } from '../schemas.js';

export async function moodRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, patientOnly];
  app.get('/api/moods', { preHandler: guard }, async (request) => {
    const q=rangeQuerySchema.parse(request.query);
    return withAccount(request.account, async(c)=>(await c.query(`select id,entry_date as "entryDate",recorded_at as "recordedAt",mood,note,is_stressed as "isStressed",stress_cause as "stressCause" from mood_entries where patient_id=$1 and entry_date between $2::date and $3::date order by recorded_at desc`,[request.account.id,q.from??jakartaDateDaysAgo(6),q.to??jakartaDate()])).rows);
  });
  app.post('/api/moods',{preHandler:guard},async(request,reply)=>{
    const m=moodCreateSchema.parse(request.body); assertAllowedEntryDate(m.entryDate);
    return withAccount(request.account,async(c)=>reply.code(201).send((await c.query(`insert into mood_entries(patient_id,entry_date,mood,note,is_stressed,stress_cause,fill_seconds) values($1,$2,$3,$4,$5,$6,$7)
      on conflict(patient_id,entry_date) do update set mood=excluded.mood,fill_seconds=mood_entries.fill_seconds+excluded.fill_seconds,note=excluded.note,is_stressed=excluded.is_stressed,stress_cause=excluded.stress_cause,recorded_at=now(),updated_at=now() returning *`,[request.account.id,m.entryDate,m.mood,m.note??null,m.isStressed,m.stressCause??null,m.fillSeconds??0])).rows[0]));
  });
  app.patch('/api/moods/:id',{preHandler:guard},async(request,reply)=>{
    const {id}=idParamsSchema.parse(request.params); const m=moodPatchSchema.parse(request.body);
    return withAccount(request.account,async(c)=>{const r=await c.query(`update mood_entries set mood=coalesce($3,mood),
      note=case when $4::boolean then $5 else note end,is_stressed=coalesce($6,is_stressed),
      stress_cause=case when $7::boolean then $8 else stress_cause end,updated_at=now()
      where id=$1 and patient_id=$2 returning *`,[id,request.account.id,m.mood??null,m.note!==undefined,m.note??null,m.isStressed??null,m.stressCause!==undefined||m.isStressed===false,m.stressCause??null]); return r.rows[0]??reply.code(404).send({error:'Entri mood tidak ditemukan'});});
  });
}
