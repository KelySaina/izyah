import { z } from 'zod';
import { uuid } from '../../utils/validation';

export const notificationParamsSchema = z.object({ id: uuid });

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.coerce.boolean().default(false),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
