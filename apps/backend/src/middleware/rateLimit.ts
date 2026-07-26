import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../lib/redis';
import { env } from '../config/env';

/**
 * Redis-backed rate limiter so limits hold across multiple backend replicas.
 * Keyed by identity when present, otherwise client IP.
 */
function makeLimiter(options: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? req.ip ?? 'anonymous',
    store: new RedisStore({
      prefix: options.prefix,
      // rate-limit-redis calls the raw command interface.
      sendCommand: (...args: string[]) =>
        redis.call(...(args as [string, ...string[]])) as Promise<never>,
    }),
    message: { error: { message: 'Too many requests, slow down.' } },
  });
}

/** Global API limiter. */
export const apiLimiter = makeLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  prefix: 'rl:api:',
});

/** Stricter limiter for write-heavy or abusable endpoints (chat, uploads). */
export const writeLimiter = makeLimiter({
  windowMs: 10_000,
  max: 20,
  prefix: 'rl:write:',
});

/**
 * Identity bootstrap has no `userId` yet, so every other limiter here falls
 * back to per-IP — which a script can trivially dodge by minting a fresh
 * identity per burst. This one is IP-keyed on purpose (it's the only lever
 * available before an identity exists) to make that specific bypass costly,
 * without adding any friction to the one-tap real bootstrap flow.
 */
export const anonBootstrapLimiter = makeLimiter({
  windowMs: 60_000,
  max: 20,
  prefix: 'rl:anon:',
});
