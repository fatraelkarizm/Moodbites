import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, patientRole } from '../auth.js';
import { withAccount } from '../db.js';

/** Naikkan versi ini setiap kali teks persetujuan di aplikasi diubah. */
export const CONSENT_VERSION = '2026-10-21';

const consentSchema = z.object({ researchConsent: z.literal(true), dataConsent: z.literal(true) });

export async function consentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/consent', { preHandler: [authenticate, patientRole] }, async (request) => {
    consentSchema.parse(request.body);
    return withAccount(request.account, async (c) => (await c.query(
      `insert into consents(patient_id, research_consent, data_consent, consent_version) values($1, true, true, $2)
       on conflict(patient_id) do update set consent_version = excluded.consent_version, agreed_at = now()
       returning consent_version as "version", agreed_at as "agreedAt"`, [request.account.id, CONSENT_VERSION])).rows[0]);
  });
}
