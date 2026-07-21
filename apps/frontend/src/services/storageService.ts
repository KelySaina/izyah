/**
 * Persistent key/value storage abstraction.
 *
 * Web implementation uses localStorage. The async signature is deliberate: the
 * future Capacitor implementation (@capacitor/preferences) is async, so callers
 * already `await` and no call sites change when we swap the backend.
 *
 * To port to native later, replace the body of these functions with Preferences
 * calls — the interface stays identical.
 */
export interface StorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const webStorage: StorageService = {
  async get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode / quota — ignore */
    }
  },
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const storage: StorageService = webStorage;

/** Convenience JSON helpers. */
export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await storage.set(key, JSON.stringify(value));
}
