import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { uuid } from '../../utils/validation';
import { rsvpSchema } from './participant.schemas';
import { rsvp, attendees } from './participant.controller';

export const participantsRouter = Router();

participantsRouter.put(
  '/events/:eventId/rsvp',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }), body: rsvpSchema }),
  asyncHandler(rsvp),
);

participantsRouter.get(
  '/events/:eventId/participants',
  validate({ params: z.object({ eventId: uuid }) }),
  asyncHandler(attendees),
);
