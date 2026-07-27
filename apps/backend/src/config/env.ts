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

// docker-compose passes unset vars as "" (not undefined). Treat "" as unset so
// optional fields stay optional and `.default()` can kick in.
const emptyToUndef = (inner: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), inner);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csv),

  // --- Auth -----------------------------------------------------------------
  // HMAC key for anonymous session tokens. MUST be overridden in production;
  // server.ts warns loudly if the dev default is used with NODE_ENV=production.
  SESSION_SECRET: emptyToUndef(z.string().min(16).default('dev-insecure-session-secret-change-me!!')),
  // Public URL of the frontend (used to build magic/callback links).
  APP_URL: emptyToUndef(z.string().url().default('http://izyah.localhost')),

  // --- OIDC (Logto) — optional until the IdP is provisioned -----------------
  // When OIDC_ISSUER is unset (or ""), account-linking is disabled and the app
  // runs anonymous-only. JWKS URI defaults to the standard OIDC discovery path.
  OIDC_ISSUER: emptyToUndef(z.string().url().optional()),
  OIDC_JWKS_URI: emptyToUndef(z.string().url().optional()),
  OIDC_AUDIENCE: emptyToUndef(z.string().optional()),
  OIDC_CLIENT_ID: emptyToUndef(z.string().optional()),

  // --- Web Push — optional until VAPID keys are provisioned -----------------
  // Generate a pair with `npx web-push generate-vapid-keys`. When unset, push
  // delivery is silently skipped (in-app/socket notifications still work).
  VAPID_PUBLIC_KEY: emptyToUndef(z.string().optional()),
  VAPID_PRIVATE_KEY: emptyToUndef(z.string().optional()),
  VAPID_SUBJECT: z.string().default('mailto:support@izyah.app'),

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

  // Single-region app: events store a wall-clock date/time with no timezone, so
  // reminders interpret them against this fixed offset. Default +180 = EAT
  // (UTC+3, no DST), where the app is used. Change if the audience moves zones.
  APP_UTC_OFFSET_MINUTES: z.coerce.number().int().min(-720).max(840).default(180),
  // How often the reminder scan runs, ms. Reminder timing is granular to this.
  REMINDER_SCAN_INTERVAL_MS: z.coerce.number().int().min(30_000).default(300_000),
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

/** Account-linking is available only once an OIDC issuer is configured. */
export const oidcEnabled = Boolean(env.OIDC_ISSUER);
/** Web Push delivery is available only once a VAPID key pair is configured. */
export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
/** Explicit JWKS override. When unset, M2 discovers it from the issuer's
 *  `/.well-known/openid-configuration` rather than guessing the path. */
export const oidcJwksUri = env.OIDC_JWKS_URI;
