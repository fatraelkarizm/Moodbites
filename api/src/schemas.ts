import { z } from 'zod';
import { dateSchema, timeSchema, uuidSchema } from './lib.js';

const optionalText = z.string().trim().max(1000).nullable().optional();

/** Detik aktif mengisi formulir (diukur di perangkat, dibatasi 1 jam). */
const fillSeconds = z.number().int().min(0).max(3600).optional();

export const foodCategories = ['karbo', 'gorengan', 'manis', 'sayur_buah', 'protein', 'minuman_manis', 'lainnya'] as const;

export const profileSchema = z.object({
  age: z.number().int().min(10).max(120),
  sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  weightKg: z.number().min(20).max(500),
  heightCm: z.number().min(80).max(250),
  education: z.string().trim().min(1).max(100),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'other']),
  occupation: z.string().trim().min(1).max(150),
  incomeGroup: z.enum(['lt_1m', '1m_3m', '3m_5m', 'gt_5m', 'prefer_not_to_say']),
  diagnosisDurationMonths: z.number().int().min(0).max(1440),
  artStatus: z.enum(['not_started', 'active', 'stopped']).nullable().optional(),
  artDurationMonths: z.number().int().min(0).max(1440).nullable().optional(),
  artRegimen: z.string().trim().max(150).nullable().optional(),
  adherence: z.enum(['good', 'moderate', 'poor']).nullable().optional(),
  cd4Category: z.string().trim().max(100).nullable().optional(),
  viralLoadCategory: z.string().trim().max(100).nullable().optional(),
  smoking: z.enum(['never', 'former', 'current']).nullable().optional(),
  alcohol: z.enum(['never', 'occasionally', 'regularly']).nullable().optional(),
  hasComplications: z.boolean(),
  complications: optionalText,
  hasTreatmentSideEffects: z.boolean(),
  treatmentSideEffects: optionalText,
}).superRefine((value, ctx) => {
  if (value.hasComplications && !value.complications?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['complications'], message: 'Tuliskan komplikasi yang dimiliki' });
  }
  if (!value.hasComplications && value.complications) {
    ctx.addIssue({ code: 'custom', path: ['complications'], message: 'Komplikasi harus kosong bila memilih tidak' });
  }
  if (value.hasTreatmentSideEffects && !value.treatmentSideEffects?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['treatmentSideEffects'], message: 'Tuliskan efek samping pengobatan' });
  }
  if (!value.hasTreatmentSideEffects && value.treatmentSideEffects) {
    ctx.addIssue({ code: 'custom', path: ['treatmentSideEffects'], message: 'Efek samping harus kosong bila memilih tidak' });
  }
});

export const mealCreateSchema = z.object({
  entryDate: dateSchema,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  eatenAt: timeSchema,
  foodName: z.string().trim().min(1).max(500),
  foodCategory: z.enum(foodCategories),
  portionSize: z.string().trim().min(1).max(100),
  servings: z.number().positive().max(100),
  mindfulness: z.number().int().min(1).max(5),
  fillSeconds,
});
export const mealPatchSchema = mealCreateSchema.omit({ entryDate: true }).partial().refine((v) => Object.keys(v).length > 0);

const moodFieldsSchema = z.object({
  mood: z.number().int().min(0).max(5),
  note: optionalText,
  isStressed: z.boolean(),
  stressCause: optionalText,
  fillSeconds,
});
const validateStress = (value: { isStressed?: boolean | undefined; stressCause?: string | null | undefined }, ctx: z.RefinementCtx) => {
  if (value.stressCause !== undefined && value.isStressed === undefined) ctx.addIssue({ code: 'custom', path: ['isStressed'], message: 'Status stres wajib dikirim bersama penyebab' });
  if (value.isStressed && !value.stressCause?.trim()) ctx.addIssue({ code: 'custom', path: ['stressCause'], message: 'Tuliskan penyebab stres' });
  if (value.isStressed !== true && value.stressCause) ctx.addIssue({ code: 'custom', path: ['stressCause'], message: 'Penyebab stres harus kosong bila memilih tidak' });
};
export const moodCreateSchema = z.object({ entryDate: dateSchema, ...moodFieldsSchema.shape }).superRefine(validateStress);
export const moodPatchSchema = moodFieldsSchema.partial()
  .refine((v) => Object.keys(v).length > 0)
  .superRefine(validateStress);

export const sleepSchema = z.object({
  entryDate: dateSchema,
  durationHours: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5),
  obstacle: optionalText,
  fillSeconds,
});

export const dayCheckSchema = z.object({ entryDate: dateSchema, mealsComplete: z.boolean() });

export const barrierOptions = ['lupa', 'sibuk', 'internet', 'hp', 'pertanyaan_sulit', 'terlalu_lama', 'privasi', 'lainnya'] as const;
export const feedbackSchema = z.object({
  ease: z.number().int().min(1).max(5),
  barriers: z.array(z.enum(barrierOptions)).max(barrierOptions.length).refine((v) => new Set(v).size === v.length, 'Pilihan hambatan ganda'),
  barriersOther: optionalText,
  suggestion: optionalText,
}).superRefine((value, ctx) => {
  if (value.barriers.includes('lainnya') && !value.barriersOther?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['barriersOther'], message: 'Tuliskan hambatan lainnya' });
  }
});

export const idParamsSchema = z.object({ id: uuidSchema });
export const rangeQuerySchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() });

export const analyticsQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  patientCode: z.string().trim().min(1).max(50).optional(),
}).refine((v) => v.from <= v.to, { path: ['to'], message: 'Tanggal akhir harus setelah tanggal awal' })
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) <= 366 * 86_400_000, { path: ['to'], message: 'Rentang maksimal 366 hari' });
