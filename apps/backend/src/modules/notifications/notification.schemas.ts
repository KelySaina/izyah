import { z } from 'zod';
import { uuid } from '../../utils/validation';

export const notificationParamsSchema = z.object({ id: uuid });

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.coerce.boolean().default(false),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// Shape of the browser's PushSubscription.toJSON() output.
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
