import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { initIdentity, updateProfile as svcUpdateProfile } from '@/services/identityService';
import type { UserDTO } from '@/types';

export const useIdentityStore = defineStore('identity', () => {
  const user = ref<UserDTO | null>(null);
  const ready = ref(false);
  let initPromise: Promise<void> | null = null;

  const id = computed(() => user.value?.id ?? null);
  const displayName = computed(() => user.value?.displayName ?? 'Guest');
  const avatar = computed(() => user.value?.avatar ?? '#7C3AED');

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

  return { user, ready, id, displayName, avatar, init, updateProfile };
});
