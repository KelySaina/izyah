import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import type { NotificationJob } from '../index';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

/**
 * Persist a notification and push it to the user in realtime if they are
 * connected. Web push / email delivery are future transports added here.
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
  logger.debug({ userId, type }, 'notification delivered');
}
