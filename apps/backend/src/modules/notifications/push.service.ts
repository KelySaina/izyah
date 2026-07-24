import webpush from 'web-push';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env, pushEnabled } from '../../config/env';

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
}

export async function saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/** Best-effort fan-out to every device a user has subscribed from. Dead
 *  subscriptions (browser says the endpoint is gone) are pruned as we go. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  if (!pushEnabled) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const payload = JSON.stringify(message);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          logger.warn({ err, userId }, 'web push delivery failed');
        }
      }
    }),
  );
}
