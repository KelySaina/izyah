import { Queue } from 'bullmq';
import { createBullConnection } from '../lib/redis';

/**
 * BullMQ queues. Created lazily so importing this module (e.g. in unit tests)
 * does not eagerly open a Redis connection. V2 uses these for media
 * processing and notification fan-out; V3 will add AI jobs on the same pattern.
 */
export const QUEUE_NAMES = {
  media: 'media-processing',
  notifications: 'notifications',
} as const;

export interface MediaJob {
  mediaId: string;
  eventId: string;
  objectKey: string;
  type: 'IMAGE' | 'VIDEO';
}

export interface NotificationJob {
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
}

let mediaQueue: Queue<MediaJob> | null = null;
let notificationQueue: Queue<NotificationJob> | null = null;

export function getMediaQueue(): Queue<MediaJob> {
  if (!mediaQueue) {
    mediaQueue = new Queue<MediaJob>(QUEUE_NAMES.media, { connection: createBullConnection() });
  }
  return mediaQueue;
}

export function getNotificationQueue(): Queue<NotificationJob> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJob>(QUEUE_NAMES.notifications, {
      connection: createBullConnection(),
    });
  }
  return notificationQueue;
}

export const enqueueMediaProcessing = (data: MediaJob) =>
  getMediaQueue().add('process', data, { removeOnComplete: 100, attempts: 3 });

export const enqueueNotification = (data: NotificationJob) =>
  getNotificationQueue().add('notify', data, { removeOnComplete: 500, attempts: 3 });
