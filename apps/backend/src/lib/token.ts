import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

/**
 * Stateless anonymous session tokens.
 *
 * Replaces the old "raw UUID as `X-User-ID`" scheme, where the identifier WAS
 * the credential — anyone who saw a user's UUID could act as them. Here the id
 * travels inside an HMAC-signed token, so a leaked id alone is worthless: the
 * server rejects anything it didn't sign with `SESSION_SECRET`.
 *
 * Format: `<payloadB64url>.<sigB64url>` — deliberately TWO parts (one dot), so
 * it is trivially distinguishable from a real JWT (three parts / two dots),
 * which is what the OIDC provider issues. The identity middleware uses that to
 * route a bearer credential to the right verifier.
 */

export interface SessionClaims {
  sub: string; // user id
  typ: 'session';
  iat: number; // issued-at (unix seconds)
}

function sign(body: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(body).digest('base64url');
}

export function signSessionToken(userId: string): string {
  const claims: SessionClaims = {
    sub: userId,
    typ: 'session',
    iat: Math.floor(Date.now() / 1000),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature + shape. Returns claims, or null if anything is off. */
export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  const expected = sign(body);
  // Constant-time compare; bail early if lengths differ (timingSafeEqual throws).
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims;
    if (claims.typ !== 'session' || typeof claims.sub !== 'string' || !claims.sub) return null;
    return claims;
  } catch {
    return null;
  }
}

/** True if a bearer credential is a real JWT (from the OIDC provider), not ours. */
export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}
