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
  const { user, token } = await api.auth.anonymous();
  setToken(token);
  setUserId(user.id);
  await setJSON(STORAGE_KEY, { token });
  return user;
}

export async function updateProfile(input: {
  displayName?: string;
  avatar?: string;
}): Promise<MeDTO> {
  return api.users.updateMe(input);
}
