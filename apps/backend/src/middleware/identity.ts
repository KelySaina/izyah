import type { Request, RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ApiError } from '../utils/http';
import { verifySessionToken, looksLikeJwt } from '../lib/token';

/**
 * Resolve the identity from a bearer credential.
 *
 * Frictionless model: no login screens. The frontend bootstraps an identity
 * (POST /api/auth/anonymous) on first visit, stores the returned *signed token*
 * locally, and sends it as `Authorization: Bearer <token>` on every request.
 *
 * Two credential shapes are accepted:
 *   • our HMAC session token (2 parts)  → verified here, maps to a user id.
 *   • an OIDC access token / JWT (3 parts) → verified against the IdP's JWKS.
 *     (Wired in M2, once Logto is provisioned; ignored until then.)
 *
 * This never rejects — routes that require an identity use `requireIdentity`.
 */
function bearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim();
}

export const identity: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  let userId: string | undefined;

  if (token) {
    if (looksLikeJwt(token)) {
      // OIDC bearer — verified via JWKS + linked to a user in M2. Anonymous-only for now.
    } else {
      const claims = verifySessionToken(token);
      if (claims) userId = claims.sub;
    }
  }

  if (userId) {
    const user = await prisma.user
      .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
      .catch(() => null);
    if (user) {
      req.userId = user.id;
      req.user = user;
    }
  }
  next();
});

/** Guard for routes that require a known identity. */
export const requireIdentity: RequestHandler = (req, _res, next) => {
  if (!req.userId) {
    throw ApiError.unauthorized('A valid bearer token is required');
  }
  next();
};
