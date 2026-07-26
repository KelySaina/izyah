import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { uuid } from '../../utils/validation';
import { createUserSchema, updateUserSchema } from './user.schemas';
import { bootstrap, me, updateMe, getById, myAnalytics } from './user.controller';

export const usersRouter = Router();

// Bootstrap is the ONLY endpoint that does not need an identity header.
usersRouter.post('/users', validate({ body: createUserSchema }), asyncHandler(bootstrap));

usersRouter.get('/users/me', requireIdentity, asyncHandler(me));
usersRouter.get('/users/me/analytics', requireIdentity, asyncHandler(myAnalytics));
usersRouter.patch(
  '/users/me',
  requireIdentity,
  validate({ body: updateUserSchema }),
  asyncHandler(updateMe),
);

usersRouter.get(
  '/users/:id',
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(getById),
);
