import { prisma } from '../../lib/prisma';
import { signSessionToken } from '../../lib/token';
import { track } from '../../analytics/track';
import type { OidcClaims } from '../../lib/oidc';
import { createUserEntity, toMeDTO, type MeDTO } from '../users/user.service';

export interface SessionResponse {
  user: MeDTO;
  /** Bearer credential for REST (`Authorization: Bearer …`) and the socket handshake. */
  token: string;
}

/**
 * Mint a brand-new anonymous identity + its signed session token. This is the
 * frictionless first-visit path — no login screen. The returned token is what
 * the client stores and replays; the user id alone is not a credential.
 *
 * Account-linking (OIDC) later UPGRADES this same user row in place.
 */
export async function createAnonymousSession(): Promise<SessionResponse> {
  const user = await createUserEntity();
  return { user: toMeDTO(user), token: signSessionToken(user.id) };
}

/**
 * Attach a verified OIDC identity and return a fresh session for the resulting
 * user. Resolution order:
 *   1. Already linked to this subject → return it (returning user / recovery).
 *   2. Existing account with the same *verified* email → attach subject, log in.
 *   3. A current anonymous session → upgrade that user in place (the claim).
 *   4. Nothing → create a new claimed account.
 *
 * In cases 1 & 2 the current anonymous user (if any) is simply abandoned — we
 * deliberately don't merge its events into the existing account (kept simple;
 * revisit if users report losing anonymous drafts on first sign-in).
 */
export async function linkOidcIdentity(
  currentUserId: string | null,
  claims: OidcClaims,
): Promise<SessionResponse> {
  // Only trust an email we can attach uniquely — verified and not already taken.
  const email = claims.email && claims.emailVerified ? claims.email : null;

  let user = await prisma.user.findUnique({ where: { authSubject: claims.sub } });

  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { authSubject: claims.sub, isClaimed: true },
      });
    }
  }

  if (!user && currentUserId) {
    user = await prisma.user.update({
      where: { id: currentUserId },
      data: { authSubject: claims.sub, email: email ?? undefined, isClaimed: true },
    });
  }

  if (!user) {
    const created = await createUserEntity({ displayName: claims.name ?? undefined });
    user = await prisma.user.update({
      where: { id: created.id },
      data: { authSubject: claims.sub, email: email ?? undefined, isClaimed: true },
    });
  }

  await track('account_claimed');
  return { user: toMeDTO(user), token: signSessionToken(user.id) };
}
