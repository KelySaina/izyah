import type { Request, Response } from 'express';
import { createPoll, listPolls, vote } from './poll.service';

/** GET /events/:eventId/polls */
export async function list(req: Request, res: Response) {
  const polls = await listPolls(req.params.eventId!, req.userId);
  res.json({ polls });
}

/** POST /events/:eventId/polls */
export async function create(req: Request, res: Response) {
  const poll = await createPoll(req.params.eventId!, req.userId!, req.user!.displayName, req.body);
  res.status(201).json(poll);
}

/** POST /events/:eventId/polls/:pollId/vote */
export async function castVote(req: Request, res: Response) {
  const poll = await vote(req.params.eventId!, req.params.pollId!, req.userId!, req.body.optionId);
  res.json(poll);
}
