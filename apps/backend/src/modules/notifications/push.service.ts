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
 *  subscriptions are pruned as we go — see the catch block for what counts. */
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
        // 404 / 410 — the push service says the endpoint is gone (site data
        // cleared, browser uninstalled).
        //
        // 403 — the subscription was created against a different VAPID key, so
        // this server can never sign for it again. A browser only accepts
        // pushes signed by the `applicationServerKey` it subscribed with, so
        // after a key rotation every pre-existing row is permanently dead. Not
        // pruning them means retrying each one on every notification forever.
        // This can't swallow a misconfiguration: `setVapidDetails` validates
        // the subject and keys at boot and throws, so a bad config fails
        // loudly at startup rather than arriving here as a 403.
        if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          if (statusCode === 403) {
            // Deliberately no endpoint in the log — it's a bearer-ish URL.
            logger.warn(
              { userId },
              'pruned a push subscription signed with a stale VAPID key — user must re-enable notifications',
            );
          }
        } else {
          logger.warn({ err, userId }, 'web push delivery failed');
        }
      }
    }),
  );
}
