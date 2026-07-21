import { Router } from 'express';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { writeLimiter } from '../../middleware/rateLimit';
import {
  createTaskSchema,
  updateTaskSchema,
  eventTaskParams,
  taskParams,
} from './task.schemas';
import { claim, create, list, release, update } from './task.controller';

export const tasksRouter = Router();

// Public read of an event's task board.
tasksRouter.get(
  '/events/:eventId/tasks',
  validate({ params: eventTaskParams }),
  asyncHandler(list),
);

tasksRouter.post(
  '/events/:eventId/tasks',
  requireIdentity,
  writeLimiter,
  validate({ params: eventTaskParams, body: createTaskSchema }),
  asyncHandler(create),
);

tasksRouter.post(
  '/events/:eventId/tasks/:taskId/claim',
  requireIdentity,
  writeLimiter,
  validate({ params: taskParams }),
  asyncHandler(claim),
);

tasksRouter.post(
  '/events/:eventId/tasks/:taskId/release',
  requireIdentity,
  writeLimiter,
  validate({ params: taskParams }),
  asyncHandler(release),
);

tasksRouter.patch(
  '/events/:eventId/tasks/:taskId',
  requireIdentity,
  writeLimiter,
  validate({ params: taskParams, body: updateTaskSchema }),
  asyncHandler(update),
);
