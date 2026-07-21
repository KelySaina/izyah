import { api, ApiError } from './api';
import { getUserId, setUserId } from './session';
import { getJSON, setJSON, storage } from './storageService';
import type { UserDTO } from '@/types';

const STORAGE_KEY = 'izyah.identity';

interface StoredIdentity {
  id: string;
}

/**
 * Frictionless anonymous identity.
 *
 * On first ever visit we create a user on the backend and persist its id.
 * On return visits we reuse the stored id (and refresh the profile). There is
 * no login screen — the id travels on every request as `X-User-ID`.
 *
 * Account-linking (email / Google / phone) will later *upgrade* this same id,
 * so nothing here needs to change when auth arrives.
 */
export async function initIdentity(): Promise<UserDTO> {
  const stored = await getJSON<StoredIdentity>(STORAGE_KEY);

  if (stored?.id) {
    setUserId(stored.id);
    try {
      return await api.users.me();
    } catch (err) {
      // Stored id no longer exists on the server (e.g. wiped DB) → re-bootstrap.
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        await storage.remove(STORAGE_KEY);
        setUserId(null);
      } else {
        throw err;
      }
    }
  }

  return bootstrap();
}

async function bootstrap(): Promise<UserDTO> {
  const user = await api.users.create({});
  setUserId(user.id);
  await setJSON(STORAGE_KEY, { id: user.id });
  return user;
}

export async function updateProfile(input: {
  displayName?: string;
  avatar?: string;
}): Promise<UserDTO> {
  return api.users.updateMe(input);
}

export function currentUserId(): string | null {
  return getUserId();
}
