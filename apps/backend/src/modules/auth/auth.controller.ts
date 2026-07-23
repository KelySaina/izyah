import type { Request, Response } from 'express';
import { toMeDTO } from '../users/user.service';
import { createAnonymousSession } from './auth.service';

/** POST /auth/anonymous — bootstrap a fresh identity + session token. */
export async function anonymous(_req: Request, res: Response) {
  const session = await createAnonymousSession();
  res.status(201).json(session);
}

/** GET /auth/me — the caller's own identity (private projection). */
export async function me(req: Request, res: Response) {
  // `requireIdentity` guarantees the token resolved to a real user.
  res.json(toMeDTO(req.user!));
}
