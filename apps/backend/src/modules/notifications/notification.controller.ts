import type { Request, Response } from 'express';
import { listNotifications, markAllRead, markRead } from './notification.service';
import { saveSubscription, removeSubscription } from './push.service';
import { env, pushEnabled } from '../../config/env';

/** GET /notifications */
export async function list(req: Request, res: Response) {
  const result = await listNotifications(req.userId!, req.query as never);
  res.json(result);
}

/** GET /notifications/push/vapid-public-key */
export function vapidPublicKey(_req: Request, res: Response) {
  res.json({ key: pushEnabled ? env.VAPID_PUBLIC_KEY : null });
}

/** POST /notifications/push/subscribe */
export async function subscribePush(req: Request, res: Response) {
  await saveSubscription(req.userId!, req.body);
  res.status(204).end();
}

/** POST /notifications/push/unsubscribe */
export async function unsubscribePush(req: Request, res: Response) {
  await removeSubscription(req.userId!, req.body.endpoint);
  res.status(204).end();
}

/** POST /notifications/:id/read */
export async function read(req: Request, res: Response) {
  const notification = await markRead(req.userId!, req.params.id!);
  res.json(notification);
}

/** POST /notifications/read-all */
export async function readAll(req: Request, res: Response) {
  const result = await markAllRead(req.userId!);
  res.json(result);
}
