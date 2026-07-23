import { signSessionToken } from '../../lib/token';
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
