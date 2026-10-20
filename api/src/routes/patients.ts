import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, researcherOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { generatePin, hashPin } from '../pin.js';
import { patientCodeSchema } from '../schemas.js';
import { ACTIVE_DAYS_SQL } from './feasibility.js';

const createSchema = z.object({ code: patientCodeSchema.optional() });
const codeParams = z.object({ code: patientCodeSchema });

/** Kode berikutnya dengan pola P001, P002, ... berdasarkan kode berpola P+angka yang sudah ada. */
async function nextCode(c: { query: (sql: string) => Promise<{ rows: Array<{ n: number | null }> }> }): Promise<string> {
  const r = await c.query(`select max(substring(code from '^P([0-9]+)$')::int) as n from accounts where code ~ '^P[0-9]+$'`);
  return `P${String((r.rows[0]?.n ?? 0) + 1).padStart(3, '0')}`;
}

export async function patientRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, researcherOnly];

  app.get('/api/admin/patients', { preHandler: guard }, async (request) => withAccount(request.account, async (c) => {
    const patients = await c.query(
      `with days as (${ACTIVE_DAYS_SQL})
       select a.code, a.created_at as "createdAt", a.pin_reset_at as "pinResetAt",
         exists(select 1 from patient_profiles p where p.patient_id = a.id) as "onboardingComplete",
         (a.locked_until is not null and a.locked_until > now()) as locked,
         (select max(entry_date) from days d where d.patient_id = a.id) as "lastEntryDate",
         (select count(*) from days d where d.patient_id = a.id)::int as "activeDays"
       from accounts a where a.role = 'patient' order by a.code`);
    return { patients: patients.rows, suggestedCode: await nextCode(c) };
  }));

  app.post('/api/admin/patients', { preHandler: guard }, async (request, reply) => {
    const body = createSchema.parse(request.body ?? {});
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    return withAccount(request.account, async (c) => {
      const code = body.code ?? await nextCode(c);
      const exists = await c.query('select 1 from accounts where upper(code) = $1', [code]);
      if (exists.rowCount) return reply.code(409).send({ error: `Kode ${code} sudah dipakai` });
      await c.query('insert into accounts(code, pin_hash, role, created_by) values($1, $2, $3, $4)', [code, pinHash, 'patient', request.account.id]);
      // PIN hanya dikirim di respons ini dan tidak pernah disimpan atau dicatat dalam bentuk asli.
      return reply.code(201).header('Cache-Control', 'no-store').send({ code, pin });
    });
  });

  app.post('/api/admin/patients/:code/reset-pin', { preHandler: guard }, async (request, reply) => {
    const { code } = codeParams.parse(request.params);
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    return withAccount(request.account, async (c) => {
      const r = await c.query<{ id: string }>(
        `update accounts set pin_hash = $2, failed_attempts = 0, locked_until = null, pin_reset_at = now()
         where upper(code) = $1 and role = 'patient' returning id`, [code, pinHash]);
      const account = r.rows[0];
      if (!account) return reply.code(404).send({ error: 'Pasien tidak ditemukan' });
      // Keluarkan semua sesi lama agar PIN lama tidak bisa dipakai di perangkat lain.
      await c.query('delete from sessions where account_id = $1', [account.id]);
      return reply.header('Cache-Control', 'no-store').send({ code, pin });
    });
  });
}
