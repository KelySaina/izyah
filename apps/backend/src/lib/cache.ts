import { redis } from './redis';
import { logger } from './logger';

/**
 * Tiny cache-aside helper over Redis. Values are JSON-serialised.
 * Used for public event pages and attendee counts (see spec: caching).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn({ err, key }, 'cache get failed');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'cache set failed');
  }
}

/** Invalidate one or more keys (best-effort). */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, 'cache del failed');
  }
}

export const cacheKeys = {
  eventPublic: (slug: string) => `cache:event:public:${slug}`,
  eventAttendees: (eventId: string) => `cache:event:attendees:${eventId}`,
};
