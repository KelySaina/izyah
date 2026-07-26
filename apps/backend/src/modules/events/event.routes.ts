import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { uuid } from '../../utils/validation';
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
} from './event.schemas';
import { create, list, getOne, update, remove, analytics } from './event.controller';

export const eventsRouter = Router();

eventsRouter.post(
  '/events',
  requireIdentity,
  validate({ body: createEventSchema }),
  asyncHandler(create),
);

eventsRouter.get(
  '/events',
  requireIdentity,
  validate({ query: listEventsQuerySchema }),
  asyncHandler(list),
);

// Public read (identity optional): accepts a UUID or a share slug.
eventsRouter.get(
  '/events/:idOrSlug',
  validate({ params: z.object({ idOrSlug: z.string().min(1).max(64) }) }),
  asyncHandler(getOne),
);

eventsRouter.patch(
  '/events/:id',
  requireIdentity,
  validate({ params: z.object({ id: uuid }), body: updateEventSchema }),
  asyncHandler(update),
);

eventsRouter.delete(
  '/events/:id',
  requireIdentity,
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(remove),
);

// Host-only per-event analytics (assertCreator inside the service).
eventsRouter.get(
  '/events/:id/analytics',
  requireIdentity,
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(analytics),
);
