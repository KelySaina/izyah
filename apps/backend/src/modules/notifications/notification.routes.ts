import { Router } from 'express';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import {
  notificationParamsSchema,
  listNotificationsQuerySchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from './notification.schemas';
import { list, read, readAll, vapidPublicKey, subscribePush, unsubscribePush } from './notification.controller';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/notifications',
  requireIdentity,
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(list),
);

notificationsRouter.get('/notifications/push/vapid-public-key', vapidPublicKey);

notificationsRouter.post(
  '/notifications/push/subscribe',
  requireIdentity,
  validate({ body: pushSubscribeSchema }),
  asyncHandler(subscribePush),
);

notificationsRouter.post(
  '/notifications/push/unsubscribe',
  requireIdentity,
  validate({ body: pushUnsubscribeSchema }),
  asyncHandler(unsubscribePush),
);

notificationsRouter.post(
  '/notifications/read-all',
  requireIdentity,
  asyncHandler(readAll),
);

notificationsRouter.post(
  '/notifications/:id/read',
  requireIdentity,
  validate({ params: notificationParamsSchema }),
  asyncHandler(read),
);
