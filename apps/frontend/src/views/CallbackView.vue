<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';

/**
 * OIDC redirect landing page. Logto sends the browser here with ?code&state;
 * we finish the exchange, link the account, then bounce to the profile.
 */
const router = useRouter();
const identity = useIdentityStore();
const ui = useUiStore();

onMounted(async () => {
  try {
    await identity.completeClaim(window.location.href);
    ui.toast('Account linked — you can now sign in from any device', 'success');
  } catch {
    ui.toast('Could not complete sign-in', 'error');
  } finally {
    // Replace so the callback URL (with its code) never stays in history.
    await router.replace('/profile');
  }
});
</script>

<template>
  <div class="grid place-items-center py-20 text-fg-3">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-line/20 border-t-brand-500" />
    <p class="mt-4 text-sm">Signing you in…</p>
  </div>
</template>
