import type { Request, Response } from 'express';
import {
  claimTask,
  createTask,
  listTasks,
  releaseTask,
  updateTask,
} from './task.service';

/** GET /events/:eventId/tasks */
export async function list(req: Request, res: Response) {
  const tasks = await listTasks(req.params.eventId!);
  res.json({ tasks });
}

/** POST /events/:eventId/tasks */
export async function create(req: Request, res: Response) {
  const task = await createTask(req.params.eventId!, req.userId!, req.user!.displayName, req.body);
  res.status(201).json(task);
}

/** POST /events/:eventId/tasks/:taskId/claim */
export async function claim(req: Request, res: Response) {
  const task = await claimTask(
    req.params.eventId!,
    req.params.taskId!,
    req.userId!,
    req.user!.displayName,
  );
  res.json(task);
}

/** POST /events/:eventId/tasks/:taskId/release */
export async function release(req: Request, res: Response) {
  const task = await releaseTask(req.params.eventId!, req.params.taskId!, req.userId!);
  res.json(task);
}

/** PATCH /events/:eventId/tasks/:taskId */
export async function update(req: Request, res: Response) {
  const task = await updateTask(req.params.eventId!, req.params.taskId!, req.body);
  res.json(task);
}
