import type { FastifyInstance } from 'fastify';
import { authenticate, patientOnly } from '../auth.js';
import { withAccount } from '../db.js';
import { profileSchema } from '../schemas.js';

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, patientOnly];
  app.get('/api/profile', { preHandler: guard }, async (request, reply) => withAccount(request.account, async (c) => {
    const result = await c.query(`select age, sex, weight_kg as "weightKg", height_cm as "heightCm", bmi,
      education, marital_status as "maritalStatus", occupation, income_group as "incomeGroup",
      diagnosis_duration_months as "diagnosisDurationMonths", has_complications as "hasComplications",
      art_status as "artStatus", art_duration_months as "artDurationMonths", art_regimen as "artRegimen",
      adherence, cd4_category as "cd4Category", viral_load_category as "viralLoadCategory", smoking, alcohol,
      complications, has_treatment_side_effects as "hasTreatmentSideEffects",
      treatment_side_effects as "treatmentSideEffects", updated_at as "updatedAt"
      from patient_profiles where patient_id = $1`, [request.account.id]);
    return result.rows[0] ?? reply.code(404).send({ error: 'Profil belum diisi' });
  }));

  app.put('/api/profile', { preHandler: guard }, async (request) => {
    const p = profileSchema.parse(request.body);
    return withAccount(request.account, async (c) => (await c.query(
      `insert into patient_profiles (patient_id, age, sex, weight_kg, height_cm, education, marital_status,
       occupation, income_group, diagnosis_duration_months, has_complications, complications,
       has_treatment_side_effects, treatment_side_effects, art_status, art_duration_months, art_regimen,
       adherence, cd4_category, viral_load_category, smoking, alcohol)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       on conflict (patient_id) do update set age=excluded.age, sex=excluded.sex, weight_kg=excluded.weight_kg,
       height_cm=excluded.height_cm, education=excluded.education, marital_status=excluded.marital_status,
       occupation=excluded.occupation, income_group=excluded.income_group,
       diagnosis_duration_months=excluded.diagnosis_duration_months, has_complications=excluded.has_complications,
       complications=excluded.complications, has_treatment_side_effects=excluded.has_treatment_side_effects,
       treatment_side_effects=excluded.treatment_side_effects, art_status=excluded.art_status,
       art_duration_months=excluded.art_duration_months, art_regimen=excluded.art_regimen,
       adherence=excluded.adherence, cd4_category=excluded.cd4_category,
       viral_load_category=excluded.viral_load_category, smoking=excluded.smoking, alcohol=excluded.alcohol, updated_at=now()
       returning *, bmi`, [request.account.id, p.age, p.sex, p.weightKg, p.heightCm, p.education, p.maritalStatus,
        p.occupation, p.incomeGroup, p.diagnosisDurationMonths, p.hasComplications, p.complications ?? null,
        p.hasTreatmentSideEffects, p.treatmentSideEffects ?? null, p.artStatus ?? null, p.artDurationMonths ?? null,
        p.artRegimen ?? null, p.adherence ?? null, p.cd4Category ?? null, p.viralLoadCategory ?? null,
        p.smoking ?? null, p.alcohol ?? null])).rows[0]);
  });
}
