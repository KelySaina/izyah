import type { Request, Response } from 'express';
import { listNotifications, markAllRead, markRead } from './notification.service';

/** GET /notifications */
export async function list(req: Request, res: Response) {
  const result = await listNotifications(req.userId!, req.query as never);
  res.json(result);
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
