import type { FastifyInstance } from 'fastify';
import { authenticate, patientOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { assertAllowedEntryDate, jakartaDate, jakartaDateDaysAgo } from '../lib.js';
import { idParamsSchema, mealCreateSchema, mealPatchSchema, rangeQuerySchema } from '../schemas.js';

export async function mealRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, patientOnly];
  app.get('/api/meals', { preHandler: guard }, async (request) => {
    const q = rangeQuerySchema.parse(request.query);
    return withAccount(request.account, async (c) => (await c.query(
      `select id, entry_date as "entryDate", meal_type as "mealType", eaten_at as "eatenAt",
       food_name as "foodName", food_category as "foodCategory", portion_size as "portionSize", servings, mindfulness, created_at as "createdAt"
       from meal_entries where patient_id=$1 and entry_date between $2::date and $3::date
       order by entry_date desc, eaten_at desc`, [request.account.id, q.from ?? jakartaDateDaysAgo(6), q.to ?? jakartaDate()])).rows);
  });
  app.post('/api/meals', { preHandler: guard }, async (request, reply) => {
    const m = mealCreateSchema.parse(request.body); assertAllowedEntryDate(m.entryDate);
    return withAccount(request.account, async (c) => reply.code(201).send((await c.query(
      `insert into meal_entries (patient_id,entry_date,meal_type,eaten_at,food_name,food_category,portion_size,servings,mindfulness,fill_seconds)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [request.account.id,m.entryDate,m.mealType,m.eatenAt,m.foodName,m.foodCategory,m.portionSize,m.servings,m.mindfulness,m.fillSeconds??0])).rows[0]));
  });
  app.patch('/api/meals/:id', { preHandler: guard }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params); const m = mealPatchSchema.parse(request.body);
    return withAccount(request.account, async (c) => {
      const result = await c.query(`update meal_entries set
       meal_type=coalesce($3,meal_type), eaten_at=coalesce($4,eaten_at), food_name=coalesce($5,food_name),
       portion_size=coalesce($6,portion_size), servings=coalesce($7,servings), food_category=coalesce($8,food_category), mindfulness=coalesce($9,mindfulness), fill_seconds=fill_seconds+$10, updated_at=now()
       where id=$1 and patient_id=$2 returning *`, [id,request.account.id,m.mealType??null,m.eatenAt??null,m.foodName??null,m.portionSize??null,m.servings??null,m.foodCategory??null,m.mindfulness??null,m.fillSeconds??0]);
      return result.rows[0] ?? reply.code(404).send({ error: 'Entri makan tidak ditemukan' });
    });
  });
}
