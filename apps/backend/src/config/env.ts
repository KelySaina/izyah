import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated, typed environment. Import `env` everywhere instead of reading
 * process.env directly, so a missing/invalid var fails fast at boot.
 */
const csv = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// z.coerce.boolean() uses Boolean(value), so ANY non-empty string is true —
// including "false". Parse env booleans explicitly instead.
const envBool = (def: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return def;
    if (typeof v === 'boolean') return v;
    return /^(1|true|yes|on)$/i.test(String(v).trim());
  }, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csv),

  SEED_ON_START: envBool(false),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ANALYTICS_ENABLED: envBool(true),

  MINIO_ENDPOINT: z.string().default('minio'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: envBool(false),
  MINIO_ROOT_USER: z.string().default('izyah-minio'),
  MINIO_ROOT_PASSWORD: z.string().default('izyah_minio_dev_password_change_me'),
  MINIO_BUCKET_MEDIA: z.string().default('izyah-media'),
  MINIO_BUCKET_AVATARS: z.string().default('izyah-avatars'),
  MINIO_PUBLIC_URL: z.string().default('http://localhost:9000'),

  RUN_WORKER_INLINE: envBool(false),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
