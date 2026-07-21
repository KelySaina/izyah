import { z } from 'zod';
import { uuid } from '../../utils/validation';

/** Route params for the event-scoped media collection. */
export const eventParamsSchema = z.object({ eventId: uuid });

/** Route params for a single media item under an event. */
export const mediaParamsSchema = z.object({ eventId: uuid, mediaId: uuid });

export type EventParams = z.infer<typeof eventParamsSchema>;
export type MediaParams = z.infer<typeof mediaParamsSchema>;
