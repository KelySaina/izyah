import type { Request, Response } from 'express';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from './event.service';
import { track } from '../../analytics/track';

/** POST /events */
export async function create(req: Request, res: Response) {
  const event = await createEvent(req.userId!, req.body);
  res.status(201).json(event);
}

/** GET /events?scope=upcoming|mine|past */
export async function list(req: Request, res: Response) {
  const events = await listEvents(req.userId!, req.query as never);
  res.json({ events });
}

/** GET /events/:idOrSlug — public (identity optional, enriches response). */
export async function getOne(req: Request, res: Response) {
  const event = await getEvent(req.params.idOrSlug!, req.userId);
  // Anonymous open of a shared link counts as an invitation view.
  if (!req.userId) await track('invitation_opened', { eventId: event.id });
  res.json(event);
}

/** PATCH /events/:id */
export async function update(req: Request, res: Response) {
  const event = await updateEvent(req.userId!, req.params.id!, req.body);
  res.json(event);
}

/** DELETE /events/:id */
export async function remove(req: Request, res: Response) {
  await deleteEvent(req.userId!, req.params.id!);
  res.status(204).send();
}
