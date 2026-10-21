import { randomBytes } from 'node:crypto';
import { verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool, withAccount, type Role } from './db.js';
import { loadConfig } from './config.js';
import { sha256 } from './lib.js';

const COOKIE = 'moodbite_session';
const loginSchema = z.object({ code: z.string().trim().min(1).max(50), pin: z.string().regex(/^\d{6,12}$/) });
const config = loadConfig();

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[COOKIE];
  if (!token) return reply.code(401).send({ error: 'Sesi tidak valid atau sudah berakhir' });
  const tokenHash = sha256(token);
  const result = await pool.query<{ id: string; role: Role }>(
    `update sessions s set expires_at = now() + ($2 * interval '1 day')
     from accounts a where s.token_hash = $1 and s.account_id = a.id and s.expires_at > now()
     returning a.id, a.role`, [tokenHash, config.SESSION_DAYS],
  );
  const account = result.rows[0];
  if (!account) {
    reply.clearCookie(COOKIE, { path: '/' });
    return reply.code(401).send({ error: 'Sesi tidak valid atau sudah berakhir' });
  }
  request.account = account;
}

/** Hanya memeriksa peran; dipakai oleh rute persetujuan itu sendiri. */
export async function patientRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.account.role !== 'patient') return reply.code(403).send({ error: 'Khusus akun pasien' });
}

/** Peran pasien, dan data hanya boleh direkam setelah pasien memberi persetujuan penelitian. */
export async function patientOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.account.role !== 'patient') return reply.code(403).send({ error: 'Khusus akun pasien' });
  if (request.method === 'GET') return;
  const consented = await withAccount(request.account, async (c) =>
    (await c.query('select 1 from consents where patient_id = $1', [request.account.id])).rowCount === 1);
  if (!consented) return reply.code(403).send({ error: 'Berikan persetujuan penelitian terlebih dahulu' });
}

export async function researcherOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.account.role !== 'researcher') return reply.code(403).send({ error: 'Khusus akun peneliti' });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request, reply) => {
    const { code, pin } = loginSchema.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<{ id: string; pin_hash: string; role: Role; failed_attempts: number; locked_until: Date | null }>(
        'select id, pin_hash, role, failed_attempts, locked_until from accounts where upper(code) = upper($1) for update', [code],
      );
      const account = result.rows[0];
      const valid = account ? await verify(account.pin_hash, pin) : false;
      if (!account || !valid || (account.locked_until && account.locked_until > new Date())) {
        if (account && (!account.locked_until || account.locked_until <= new Date())) {
          await client.query(
            `update accounts set failed_attempts = failed_attempts + 1,
             locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
             where id = $1`, [account.id],
          );
        }
        await client.query('commit');
        return reply.code(401).send({ error: 'Kode atau PIN tidak valid' });
      }
      await client.query('update accounts set failed_attempts = 0, locked_until = null where id = $1', [account.id]);
      const token = randomBytes(32).toString('base64url');
      await client.query(
        `insert into sessions (token_hash, account_id, expires_at)
         values ($1, $2, now() + ($3 * interval '1 day'))`, [sha256(token), account.id, config.SESSION_DAYS],
      );
      await client.query('commit');
      reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', maxAge: config.SESSION_DAYS * 86400 });
      return { role: account.role };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  });

  app.post('/api/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const token = request.cookies[COOKIE];
    if (token) await pool.query('delete from sessions where token_hash = $1', [sha256(token)]);
    reply.clearCookie(COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
