import { api, ApiError } from './api';
import { setToken, setUserId } from './session';
import { getJSON, setJSON, storage } from './storageService';
import type { MeDTO } from '@/types';

const STORAGE_KEY = 'izyah.session';

interface StoredSession {
  token: string;
}

/**
 * Frictionless anonymous identity.
 *
 * On first ever visit we bootstrap an identity on the backend and persist the
 * signed session token it returns. On return visits we reuse the stored token
 * (and refresh the profile). There is no login screen — the token travels on
 * every request as `Authorization: Bearer <token>`.
 *
 * Account-linking (email / Google via OIDC) will later *upgrade* this same id,
 * so nothing here needs to change when auth arrives.
 */
export async function initIdentity(): Promise<MeDTO> {
  const stored = await getJSON<StoredSession>(STORAGE_KEY);

  if (stored?.token) {
    setToken(stored.token);
    try {
      const me = await api.auth.me();
      setUserId(me.id);
      return me;
    } catch (err) {
      // Stored token no longer valid (rotated secret / wiped DB) → re-bootstrap.
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        await storage.remove(STORAGE_KEY);
        setToken(null);
        setUserId(null);
      } else {
        throw err;
      }
    }
  }

  return bootstrap();
}

async function bootstrap(): Promise<MeDTO> {
  return applySession(await api.auth.anonymous());
}

/** Persist a session (token + user) and make it the active identity. */
export async function applySession(session: { user: MeDTO; token: string }): Promise<MeDTO> {
  setToken(session.token);
  setUserId(session.user.id);
  await setJSON(STORAGE_KEY, { token: session.token });
  return session.user;
}

/** Exchange an OIDC ID token for a session and adopt it (claim / recover). */
export async function linkIdToken(idToken: string): Promise<MeDTO> {
  return applySession(await api.auth.link(idToken));
}

/** Drop the current session and return to a fresh anonymous identity. */
export async function resetIdentity(): Promise<MeDTO> {
  try {
    await api.auth.logout();
  } catch {
    /* stateless — best effort */
  }
  await storage.remove(STORAGE_KEY);
  setToken(null);
  setUserId(null);
  return bootstrap();
}

export async function updateProfile(input: {
  displayName?: string;
  avatar?: string;
}): Promise<MeDTO> {
  return api.users.updateMe(input);
}
