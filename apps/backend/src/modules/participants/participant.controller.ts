import type { Request, Response } from 'express';
import { setRsvp, listAttendees } from './participant.service';

/** PUT /events/:eventId/rsvp */
export async function rsvp(req: Request, res: Response) {
  const result = await setRsvp(
    req.params.eventId!,
    req.userId!,
    req.user!.displayName,
    req.body.status,
  );
  res.json(result);
}

/** GET /events/:eventId/participants — public. */
export async function attendees(req: Request, res: Response) {
  const result = await listAttendees(req.params.eventId!);
  res.json(result);
}
