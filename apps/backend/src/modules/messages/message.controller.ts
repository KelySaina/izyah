import type { Request, Response } from 'express';
import { createMessage, listMessages } from './message.service';
import { getIo, eventRoom } from '../../realtime/io';

/** GET /events/:eventId/messages */
export async function list(req: Request, res: Response) {
  const messages = await listMessages(req.params.eventId!, req.query as never);
  res.json({ messages });
}

/** POST /events/:eventId/messages — persists and broadcasts over WS. */
export async function post(req: Request, res: Response) {
  const message = await createMessage({
    eventId: req.params.eventId!,
    userId: req.userId!,
    content: req.body.content,
  });
  try {
    getIo().to(eventRoom(message.eventId)).emit('chat:message', message);
  } catch {
    /* socket server not running */
  }
  res.status(201).json(message);
}
