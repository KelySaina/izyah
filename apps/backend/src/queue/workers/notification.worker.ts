import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import type { NotificationJob } from '../index';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sendPushToUser, type PushMessage } from '../../modules/notifications/push.service';

/** Mirrors the frontend's NotificationsSheet text() mapping — kept in sync
 *  by hand since the two apps don't share a package. */
function toPushMessage(type: string, payload: Record<string, unknown> | null): PushMessage {
  const p = (payload ?? {}) as Record<string, string>;
  const url = p.eventSlug ? `/event/${p.eventSlug}` : undefined;

  if (type === 'rsvp_going') {
    return { title: "You're hosting", body: `${p.displayName} is going to "${p.eventTitle}"`, url };
  }
  if (type === 'waitlist_promoted') {
    return { title: "You're in!", body: `You're off the waitlist for "${p.eventTitle}"`, url };
  }
  if (type === 'task_claimed') {
    return {
      title: p.eventTitle ?? "Izy'Ah",
      body: `${p.displayName} claimed "${p.taskTitle}"`,
      url,
    };
  }
  return { title: "Izy'Ah", body: 'You have a new notification', url };
}

/**
 * Persist a notification, push it to the user in realtime if they are
 * connected, and fan out a Web Push message for when they aren't.
 */
export async function processNotification(job: Job<NotificationJob>): Promise<void> {
  const { userId, type, payload } = job.data;
  const notification = await prisma.notification.create({
    data: { userId, type, payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined },
  });

  // Best-effort realtime delivery. Imported lazily to avoid a hard dependency
  // on Socket.IO being initialised in worker-only processes.
  try {
    const { getIo } = await import('../../realtime/io');
    getIo().to(`user:${userId}`).emit('notification:new', notification);
  } catch {
    // No live socket server in this process — the row is persisted regardless.
  }

  await sendPushToUser(userId, toPushMessage(type, payload ?? null)).catch((err) =>
    logger.warn({ err, userId, type }, 'push fan-out failed'),
  );

  logger.debug({ userId, type }, 'notification delivered');
}
