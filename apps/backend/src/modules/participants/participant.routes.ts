import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { uuid } from '../../utils/validation';
import { rsvpSchema, attendeePatchSchema, checkinSchema } from './participant.schemas';
import { rsvp, attendees, myTicket, patchAttendee, checkin } from './participant.controller';

export const participantsRouter = Router();

participantsRouter.put(
  '/events/:eventId/rsvp',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }), body: rsvpSchema }),
  asyncHandler(rsvp),
);

// Static-segment routes registered before the dynamic /:userId one below,
// so e.g. "me" never gets swallowed as a userId param.
participantsRouter.get(
  '/events/:eventId/participants/me/ticket',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }) }),
  asyncHandler(myTicket),
);

participantsRouter.post(
  '/events/:eventId/participants/checkin',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }), body: checkinSchema }),
  asyncHandler(checkin),
);

participantsRouter.patch(
  '/events/:eventId/participants/:userId',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid, userId: uuid }), body: attendeePatchSchema }),
  asyncHandler(patchAttendee),
);

participantsRouter.get(
  '/events/:eventId/participants',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }) }),
  asyncHandler(attendees),
);
