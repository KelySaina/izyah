// Tiny in-memory holder for the current anonymous user id. Kept dependency-free
// so both the API client and the identity service can read/write it without a
// circular import. Persistence lives in identityService via storageService.

let currentUserId: string | null = null;

export function getUserId(): string | null {
  return currentUserId;
}

export function setUserId(id: string | null): void {
  currentUserId = id;
}
