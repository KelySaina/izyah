// Tiny in-memory holder for the current session. Kept dependency-free so both
// the API client and the socket client can read it without a circular import.
// Persistence (localStorage) lives in identityService via storageService.
//
// The `token` is the signed credential sent on every request; the `userId` is
// a convenience copy of the resolved identity (never used as a credential).

let currentToken: string | null = null;
let currentUserId: string | null = null;

export function getToken(): string | null {
  return currentToken;
}
export function setToken(token: string | null): void {
  currentToken = token;
}

export function getUserId(): string | null {
  return currentUserId;
}
export function setUserId(id: string | null): void {
  currentUserId = id;
}
