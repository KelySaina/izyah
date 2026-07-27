import type { Event } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { enqueueNotification } from '../../queue';

/**
 * Event reminders. Events store a wall-clock day (`date`, at UTC midnight of the
 * event day) plus an optional `startTime` string ("HH:MM"), with no timezone —
 * so we interpret them against a single app offset (env.APP_UTC_OFFSET_MINUTES,
 * default EAT / UTC+3). From that we derive the real instant the reminder
 * should fire and, on a periodic scan, push it to GOING/MAYBE attendees.
 *
 * Rules (see the product decision behind them):
 *   • start time set  → fire `reminderLeadMinutes` before the start.
 *   • date only       → fire the evening before (18:00 app-local); the exact
 *                       lead value is ignored, any non-null just means "on".
 *   • reminderLeadMinutes null → no reminder.
 */

const OFFSET_MS = () => env.APP_UTC_OFFSET_MINUTES * 60_000;
const EVENING_BEFORE_HOUR = 18;

/** UTC instant of a given app-local wall-clock moment on the event's day. */
function appLocalInstant(date: Date, hour: number, minute: number, dayDelta = 0): number {
  // `date` is stored at UTC midnight of the event day, so its UTC Y/M/D IS the
  // event day. Build the wall-clock moment in UTC, then subtract the offset to
  // get the true instant (app-local = UTC + offset ⇒ UTC = app-local − offset).
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate() + dayDelta;
  return Date.UTC(y, m, d, hour, minute) - OFFSET_MS();
}

/**
 * The instant the event itself starts (app-local), and the instant its reminder
 * should fire. Returns null when reminders are off for this event.
 */
export function reminderTimes(event: Pick<Event, 'date' | 'startTime' | 'reminderLeadMinutes'>): {
  startInstant: number;
  fireAt: number;
} | null {
  if (event.reminderLeadMinutes == null) return null;

  if (event.startTime) {
    const parts = event.startTime.split(':');
    const h = Number(parts[0]);
    const min = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    const startInstant = appLocalInstant(event.date, h, min);
    return { startInstant, fireAt: startInstant - event.reminderLeadMinutes * 60_000 };
  }

  // Date-only: the "start" is the beginning of the event day; remind at 18:00
  // the evening before.
  const startInstant = appLocalInstant(event.date, 0, 0);
  return { startInstant, fireAt: appLocalInstant(event.date, EVENING_BEFORE_HOUR, 0, -1) };
}

/**
 * Send one event's reminder: claim it atomically (so overlapping scans or
 * multiple worker replicas can't double-send), then fan out to everyone GOING
 * or MAYBE. The claim also serves as the sent-marker.
 */
async function fireReminder(event: Event): Promise<number> {
  // Atomic claim: only the update that flips a still-null reminderSentAt wins.
  const claimed = await prisma.event.updateMany({
    where: { id: event.id, reminderSentAt: null },
    data: { reminderSentAt: new Date() },
  });
  if (claimed.count === 0) return 0;

  const recipients = await prisma.eventParticipant.findMany({
    where: { eventId: event.id, status: { in: ['GOING', 'MAYBE'] } },
    select: { userId: true },
  });

  const payload = {
    eventTitle: event.title,
    eventSlug: event.slug,
    startTime: event.startTime ?? '',
    allDay: event.startTime ? '' : '1',
  };
  await Promise.all(
    recipients.map((r) =>
      enqueueNotification({ userId: r.userId, type: 'event_reminder', payload }).catch(() => undefined),
    ),
  );
  return recipients.length;
}

/**
 * Scan for events whose reminder is now due and fire them. Idempotent and
 * safe to run on an interval: the per-event atomic claim prevents re-sends,
 * and fire-time is recomputed from live event data each pass so edits and
 * reschedules are picked up automatically.
 */
export async function runReminderScan(now: number = Date.now()): Promise<void> {
  // Candidate window: reminders on, not yet sent, and the event day is within
  // the last day or the future (so past events and long-done ones are skipped
  // cheaply before the per-event time math).
  const since = new Date(now - 36 * 60 * 60 * 1000); // event day >= ~1.5 days ago
  const candidates = await prisma.event.findMany({
    where: { reminderLeadMinutes: { not: null }, reminderSentAt: null, date: { gte: since } },
    orderBy: { date: 'asc' },
    take: 500,
  });

  let fired = 0;
  for (const event of candidates) {
    const t = reminderTimes(event);
    if (!t) continue;
    // Due, but don't send a reminder for something that already started (e.g.
    // after downtime) — a "starts in 2h" ping an hour late is worse than none.
    if (t.fireAt <= now && t.startInstant > now) {
      const sent = await fireReminder(event);
      if (sent >= 0) fired += 1;
      logger.info({ eventId: event.id, recipients: sent }, 'event reminder fired');
    }
  }
  if (fired) logger.info({ fired }, 'reminder scan complete');
}
