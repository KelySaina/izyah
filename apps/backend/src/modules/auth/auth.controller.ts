import type { Request, Response } from 'express';
import { verifyOidcIdToken } from '../../lib/oidc';
import { toMeDTO } from '../users/user.service';
import { createAnonymousSession, linkOidcIdentity } from './auth.service';

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

/**
 * POST /auth/link — exchange a verified OIDC ID token for a session.
 * Identity is optional: `req.userId` is the current anonymous user to upgrade
 * (if a session token was sent), otherwise this is a fresh sign-in.
 */
export async function link(req: Request, res: Response) {
  const claims = await verifyOidcIdToken(req.body.idToken);
  const session = await linkOidcIdentity(req.userId ?? null, claims);
  res.json(session);
}

/** POST /auth/logout — stateless tokens, nothing to revoke server-side. */
export async function logout(_req: Request, res: Response) {
  res.status(204).send();
}
