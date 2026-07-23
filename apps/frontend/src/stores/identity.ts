import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  initIdentity,
  linkIdToken,
  resetIdentity,
  updateProfile as svcUpdateProfile,
} from '@/services/identityService';
import { completeSignIn, oidcConfigured, startSignIn } from '@/services/oidcService';
import type { MeDTO } from '@/types';

export const useIdentityStore = defineStore('identity', () => {
  const user = ref<MeDTO | null>(null);
  const ready = ref(false);
  let initPromise: Promise<void> | null = null;

  const id = computed(() => user.value?.id ?? null);
  const displayName = computed(() => user.value?.displayName ?? 'Guest');
  const avatar = computed(() => user.value?.avatar ?? '#7C3AED');
  const isClaimed = computed(() => user.value?.isClaimed ?? false);
  const email = computed(() => user.value?.email ?? null);
  /** Whether account-linking (Logto) is available in this build. */
  const canLink = oidcConfigured();

  /** Idempotent: safe to call from a router guard on every navigation. */
  async function init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        user.value = await initIdentity();
      } finally {
        // Always let the app render; views handle a null user / offline state.
        ready.value = true;
      }
    })();
    return initPromise;
  }

  async function updateProfile(input: { displayName?: string; avatar?: string }): Promise<void> {
    user.value = await svcUpdateProfile(input);
  }

  /** Kick off the OIDC login (redirects the browser to Logto). */
  async function claim(): Promise<void> {
    await startSignIn();
  }

  /** Finish the OIDC redirect on /callback: verify → link → adopt session. */
  async function completeClaim(url: string): Promise<void> {
    const idToken = await completeSignIn(url);
    user.value = await linkIdToken(idToken);
  }

  /** Sign out locally: drop the session and return to a fresh anonymous id. */
  async function signOut(): Promise<void> {
    user.value = await resetIdentity();
  }

  return {
    user,
    ready,
    id,
    displayName,
    avatar,
    isClaimed,
    email,
    canLink,
    init,
    updateProfile,
    claim,
    completeClaim,
    signOut,
  };
});
