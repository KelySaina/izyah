import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * Privacy-friendly analytics. We record only aggregate counters and coarse
 * funnel events keyed by event/day — never PII, never cross-site identifiers.
 * Counters live in Redis and can be shipped to a warehouse later by a job.
 */
export type AnalyticsEvent =
  | 'event_created'
  | 'invitation_opened'
  | 'rsvp_going'
  | 'rsvp_maybe'
  | 'rsvp_not_going'
  | 'attendance_marked'
  | 'user_created'
  | 'account_claimed'
  | 'message_sent'
  | 'media_uploaded';

export async function track(
  eventName: AnalyticsEvent,
  meta: { eventId?: string; day?: string } = {},
): Promise<void> {
  if (!env.ANALYTICS_ENABLED) return;
  try {
    const pipe = redis.multi();
    pipe.hincrby('analytics:totals', eventName, 1);
    if (meta.eventId) {
      pipe.hincrby(`analytics:event:${meta.eventId}`, eventName, 1);
    }
    await pipe.exec();
  } catch (err) {
    // Analytics must never break a request.
    logger.debug({ err, eventName }, 'analytics track failed');
  }
}

/** Read aggregate totals (for a future dashboard). */
export async function totals(): Promise<Record<string, number>> {
  const raw = await redis.hgetall('analytics:totals');
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
}
