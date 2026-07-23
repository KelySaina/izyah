import LogtoClient, { UserScope } from '@logto/browser';

/**
 * Thin wrapper around the Logto SPA SDK. OIDC is optional: when the env vars
 * are absent the app stays anonymous-only and the UI hides the sign-in entry.
 *
 * Flow: startSignIn() redirects to Logto → Logto redirects back to /callback →
 * completeSignIn() finishes PKCE and returns the raw ID token, which we hand to
 * the backend (POST /auth/link) to upgrade/recover the account.
 */
const issuer = import.meta.env.VITE_OIDC_ISSUER;
const appId = import.meta.env.VITE_OIDC_CLIENT_ID;
// The SDK wants the Logto base endpoint, not the `/oidc` issuer path.
const endpoint = issuer?.replace(/\/oidc\/?$/, '');

const REDIRECT_URI = `${window.location.origin}/callback`;

let client: LogtoClient | null = null;

export function oidcConfigured(): boolean {
  return Boolean(endpoint && appId);
}

function getClient(): LogtoClient {
  if (!endpoint || !appId) throw new Error('OIDC is not configured');
  if (!client) {
    client = new LogtoClient({
      endpoint,
      appId,
      scopes: [UserScope.Email, UserScope.Profile],
    });
  }
  return client;
}

/** Redirects the browser to Logto. */
export async function startSignIn(): Promise<void> {
  await getClient().signIn(REDIRECT_URI);
}

/** True if the given URL is a Logto sign-in redirect we should handle. */
export async function isCallback(url: string): Promise<boolean> {
  return oidcConfigured() ? getClient().isSignInRedirected(url) : false;
}

/** Finish the PKCE exchange and return the raw ID token for /auth/link. */
export async function completeSignIn(url: string): Promise<string> {
  const c = getClient();
  await c.handleSignInCallback(url);
  const idToken = await c.getIdToken();
  if (!idToken) throw new Error('No ID token returned by the identity provider');
  return idToken;
}
