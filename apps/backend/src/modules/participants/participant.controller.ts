import type { Request, Response } from 'express';
import {
  setRsvp,
  listAttendees,
  getMyTicket,
  updateAttendee,
  checkInByTicket,
} from './participant.service';

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

/** GET /events/:eventId/participants/me/ticket — self only, no host check. */
export async function myTicket(req: Request, res: Response) {
  const ticket = await getMyTicket(req.params.eventId!, req.userId!);
  res.json({ ticket });
}

/** PATCH /events/:eventId/participants/:userId — host-only. */
export async function patchAttendee(req: Request, res: Response) {
  const attendee = await updateAttendee(
    req.userId!,
    req.params.eventId!,
    req.params.userId!,
    req.body,
  );
  res.json(attendee);
}

/** POST /events/:eventId/participants/checkin — host-only, scan-by-code. */
export async function checkin(req: Request, res: Response) {
  const result = await checkInByTicket(req.userId!, req.params.eventId!, req.body.ticketCode);
  res.json(result);
}
