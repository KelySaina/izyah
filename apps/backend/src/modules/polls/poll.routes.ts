import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { writeLimiter } from '../../middleware/rateLimit';
import { uuid } from '../../utils/validation';
import { createPollSchema, voteSchema } from './poll.schemas';
import { list, create, castVote } from './poll.controller';

export const pollsRouter = Router();

pollsRouter.get(
  '/events/:eventId/polls',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }) }),
  asyncHandler(list),
);

pollsRouter.post(
  '/events/:eventId/polls',
  requireIdentity,
  writeLimiter,
  validate({ params: z.object({ eventId: uuid }), body: createPollSchema }),
  asyncHandler(create),
);

pollsRouter.post(
  '/events/:eventId/polls/:pollId/vote',
  requireIdentity,
  writeLimiter,
  validate({ params: z.object({ eventId: uuid, pollId: uuid }), body: voteSchema }),
  asyncHandler(castVote),
);
