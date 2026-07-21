import { Router } from 'express';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { notificationParamsSchema, listNotificationsQuerySchema } from './notification.schemas';
import { list, read, readAll } from './notification.controller';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/notifications',
  requireIdentity,
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(list),
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
