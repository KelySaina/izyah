// Runs before any module import. Guarantees `env.ts` can parse a valid config
// even in a bare CI environment (URL *format* only — no connectivity needed).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://izyah:izyah@localhost:5432/izyah_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.LOG_LEVEL ??= 'error';
process.env.ANALYTICS_ENABLED ??= 'false';
