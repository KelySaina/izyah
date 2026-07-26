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
  | 'rsvp_waitlisted'
  | 'attendance_marked'
  | 'user_created'
  | 'account_claimed'
  | 'message_sent'
  | 'media_uploaded';

/** UTC day bucket, e.g. "2026-07-26" — matches the app's day-granular date
 *  handling elsewhere (events are bucketed by UTC midnight too). */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function track(
  eventName: AnalyticsEvent,
  meta: { eventId?: string } = {},
): Promise<void> {
  if (!env.ANALYTICS_ENABLED) return;
  try {
    const day = dayKey(new Date());
    const pipe = redis.multi();
    pipe.hincrby('analytics:totals', eventName, 1);
    if (meta.eventId) {
      pipe.hincrby(`analytics:event:${meta.eventId}`, eventName, 1);
      pipe.hincrby(`analytics:event:${meta.eventId}:daily:${day}`, eventName, 1);
      // Daily buckets accumulate forever otherwise — 13 months covers any
      // trailing-year chart with room to spare.
      pipe.expire(`analytics:event:${meta.eventId}:daily:${day}`, 60 * 60 * 24 * 400);
    }
    await pipe.exec();
  } catch (err) {
    // Analytics must never break a request.
    logger.debug({ err, eventName }, 'analytics track failed');
  }
}

const ALL_EVENTS: AnalyticsEvent[] = [
  'event_created',
  'invitation_opened',
  'rsvp_going',
  'rsvp_maybe',
  'rsvp_not_going',
  'rsvp_waitlisted',
  'attendance_marked',
  'user_created',
  'account_claimed',
  'message_sent',
  'media_uploaded',
];

/** Only these are ever tracked with an `eventId` (see call sites) — the rest
 *  (user_created, account_claimed) are instance-wide, not tied to one event. */
export const EVENT_SCOPED_EVENTS: AnalyticsEvent[] = [
  'invitation_opened',
  'rsvp_going',
  'rsvp_maybe',
  'rsvp_not_going',
  'rsvp_waitlisted',
  'message_sent',
  'media_uploaded',
];

/** Same as EVENT_SCOPED_EVENTS plus event_created — meaningful once summed
 *  across every event a host has created (a per-event count of 1 isn't). */
export const HOST_SCOPED_EVENTS: AnalyticsEvent[] = ['event_created', ...EVENT_SCOPED_EVENTS];

export interface DailyPoint {
  date: string;
  counts: Record<AnalyticsEvent, number>;
}

function zeroRecord(keys: AnalyticsEvent[]): Record<AnalyticsEvent, number> {
  const result = {} as Record<AnalyticsEvent, number>;
  for (const k of keys) result[k] = 0;
  return result;
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    days.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
  }
  return days;
}

/** Read instance-wide aggregate totals. Zero-fills event types that haven't
 *  fired yet, so a future dashboard always shows the full set of counters. */
export async function totals(): Promise<Record<AnalyticsEvent, number>> {
  const raw = await redis.hgetall('analytics:totals');
  const result = {} as Record<AnalyticsEvent, number>;
  for (const name of ALL_EVENTS) result[name] = Number(raw[name] ?? 0);
  return result;
}

/** Read one event's own lifetime counters — the host's per-event analytics. */
export async function eventTotals(eventId: string): Promise<Record<AnalyticsEvent, number>> {
  const raw = await redis.hgetall(`analytics:event:${eventId}`);
  const result = {} as Record<AnalyticsEvent, number>;
  for (const name of EVENT_SCOPED_EVENTS) result[name] = Number(raw[name] ?? 0);
  return result;
}

/** One event's day-by-day series for the last `days` days, for charting. */
export async function eventDailySeries(eventId: string, days: number): Promise<DailyPoint[]> {
  const dates = lastNDays(days);
  const pipe = redis.multi();
  for (const date of dates) pipe.hgetall(`analytics:event:${eventId}:daily:${date}`);
  const raw = (await pipe.exec()) ?? [];
  return dates.map((date, i) => {
    const hash = (raw[i]?.[1] ?? {}) as Record<string, string>;
    const counts = zeroRecord(EVENT_SCOPED_EVENTS);
    for (const name of EVENT_SCOPED_EVENTS) counts[name] = Number(hash[name] ?? 0);
    return { date, counts };
  });
}

/** Sum of eventTotals() across every event in `eventIds` — a host's lifetime
 *  totals across everything they've created, plus how many events that is. */
export async function hostTotals(eventIds: string[]): Promise<Record<AnalyticsEvent, number>> {
  const result = zeroRecord(HOST_SCOPED_EVENTS);
  result.event_created = eventIds.length;
  if (eventIds.length === 0) return result;

  const pipe = redis.multi();
  for (const id of eventIds) pipe.hgetall(`analytics:event:${id}`);
  const raw = (await pipe.exec()) ?? [];
  for (const entry of raw) {
    const hash = (entry?.[1] ?? {}) as Record<string, string>;
    for (const name of EVENT_SCOPED_EVENTS) result[name] += Number(hash[name] ?? 0);
  }
  return result;
}

/** Day-by-day series summed across every event in `eventIds` — a host's
 *  activity trend across everything they've created. */
export async function hostDailySeries(eventIds: string[], days: number): Promise<DailyPoint[]> {
  const dates = lastNDays(days);
  if (eventIds.length === 0) {
    return dates.map((date) => ({ date, counts: zeroRecord(EVENT_SCOPED_EVENTS) }));
  }

  const pipe = redis.multi();
  for (const date of dates) {
    for (const id of eventIds) pipe.hgetall(`analytics:event:${id}:daily:${date}`);
  }
  const raw = (await pipe.exec()) ?? [];

  return dates.map((date, dateIdx) => {
    const counts = zeroRecord(EVENT_SCOPED_EVENTS);
    for (let e = 0; e < eventIds.length; e++) {
      const hash = (raw[dateIdx * eventIds.length + e]?.[1] ?? {}) as Record<string, string>;
      for (const name of EVENT_SCOPED_EVENTS) counts[name] += Number(hash[name] ?? 0);
    }
    return { date, counts };
  });
}
