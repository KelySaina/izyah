import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env, oidcEnabled, oidcJwksUri } from '../config/env';
import { ApiError } from '../utils/http';
import { logger } from './logger';

/**
 * OIDC (Logto) ID-token verification.
 *
 * Used only at *claim time*: the frontend completes the OIDC login, then hands
 * the raw ID token to POST /auth/link. We verify it once here (signature via the
 * issuer's JWKS + issuer/audience), extract the identity, and hand back to the
 * link logic. Normal API traffic never carries an OIDC token — the app runs on
 * our own session token.
 */
export interface OidcClaims {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

let jwks: JWTVerifyGetKey | null = null;

/** JWKS endpoint: explicit override, else OIDC discovery from the issuer. */
async function resolveJwksUri(): Promise<string> {
  if (oidcJwksUri) return oidcJwksUri;
  const base = env.OIDC_ISSUER!.replace(/\/$/, '');
  const res = await fetch(`${base}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as { jwks_uri?: string };
  if (!doc.jwks_uri) throw new Error('OIDC discovery returned no jwks_uri');
  return doc.jwks_uri;
}

async function getJwks(): Promise<JWTVerifyGetKey> {
  if (!jwks) {
    const uri = await resolveJwksUri();
    jwks = createRemoteJWKSet(new URL(uri));
  }
  return jwks;
}

export async function verifyOidcIdToken(idToken: string): Promise<OidcClaims> {
  if (!oidcEnabled) throw ApiError.badRequest('Account-linking is not enabled');

  let payload;
  try {
    const keyset = await getJwks();
    ({ payload } = await jwtVerify(idToken, keyset, {
      issuer: env.OIDC_ISSUER,
      // Skips the check when OIDC_CLIENT_ID is unset; signature + issuer still enforced.
      audience: env.OIDC_CLIENT_ID,
    }));
  } catch (err) {
    logger.warn({ err }, 'OIDC id_token verification failed');
    throw ApiError.unauthorized('Invalid identity token');
  }

  if (!payload.sub) throw ApiError.unauthorized('Identity token missing subject');
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
