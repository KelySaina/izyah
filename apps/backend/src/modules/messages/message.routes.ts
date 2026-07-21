import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { writeLimiter } from '../../middleware/rateLimit';
import { uuid } from '../../utils/validation';
import { createMessageSchema, listMessagesQuerySchema } from './message.schemas';
import { list, post } from './message.controller';

export const messagesRouter = Router();

messagesRouter.get(
  '/events/:eventId/messages',
  requireIdentity,
  validate({ params: z.object({ eventId: uuid }), query: listMessagesQuerySchema }),
  asyncHandler(list),
);

messagesRouter.post(
  '/events/:eventId/messages',
  requireIdentity,
  writeLimiter,
  validate({ params: z.object({ eventId: uuid }), body: createMessageSchema }),
  asyncHandler(post),
);
