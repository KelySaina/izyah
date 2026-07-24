import { z } from 'zod';
import { uuid } from '../../utils/validation';

/** Route params for the event-scoped media collection. */
export const eventParamsSchema = z.object({ eventId: uuid });

/** Route params for a single media item under an event. */
export const mediaParamsSchema = z.object({ eventId: uuid, mediaId: uuid });

export const listMediaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  before: z.coerce.date().optional(),
});

export type EventParams = z.infer<typeof eventParamsSchema>;
export type MediaParams = z.infer<typeof mediaParamsSchema>;
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
