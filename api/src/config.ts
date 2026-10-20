import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.string().url().optional(),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(3),
  DB_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  // Tampilkan pola pribadi (timeline + kesimpulan) ke pasien. Matikan bila komite etik tidak menyetujui.
  PATIENT_INSIGHTS: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
});

export type Config = z.infer<typeof configSchema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
