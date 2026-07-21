<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { initials, isColorAvatar } from '@/lib/format';

const identity = useIdentityStore();
const ui = useUiStore();
const route = useRoute();

// PWA update lifecycle.
const { needRefresh, updateServiceWorker } = useRegisterSW();

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ui.setInstallPrompt(e as never);
  });
});

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/dashboard', label: 'Events', icon: '🗓️' },
  { to: '/profile', label: 'You', icon: '👤' },
];
</script>

<template>
  <!-- Splash while the anonymous identity bootstraps -->
  <div
    v-if="!identity.ready"
    class="fixed inset-0 grid place-items-center bg-ink-900 text-center"
  >
    <div class="animate-pulse">
      <div class="mx-auto mb-4 h-16 w-16 rounded-2xl bg-brand-600" />
      <p class="text-lg font-semibold tracking-tight">Izy'Ah</p>
      <p class="text-sm text-slate-500">Getting things ready…</p>
    </div>
  </div>

  <div v-else class="mx-auto flex min-h-full max-w-md flex-col">
    <!-- Top bar -->
    <header
      class="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur"
    >
      <RouterLink to="/" class="flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black">Iz</span>
        <span class="text-base font-bold tracking-tight">Izy'Ah</span>
      </RouterLink>
      <div class="flex items-center gap-2">
        <button
          v-if="ui.canInstall"
          class="btn-ghost !px-3 !py-1.5 text-xs"
          @click="ui.promptInstall()"
        >
          Install
        </button>
        <button class="btn-ghost !px-2.5 !py-1.5 text-xs" @click="ui.toggleTheme()">
          {{ ui.theme === 'dark' ? '🌙' : '☀️' }}
        </button>
        <RouterLink to="/profile" aria-label="Your profile">
          <span
            v-if="identity.user"
            class="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white"
            :style="isColorAvatar(identity.avatar) ? { backgroundColor: identity.avatar } : {}"
          >
            <img
              v-if="!isColorAvatar(identity.avatar)"
              :src="identity.avatar"
              class="h-8 w-8 rounded-full object-cover"
              alt=""
            />
            <template v-else>{{ initials(identity.displayName) }}</template>
          </span>
        </RouterLink>
      </div>
    </header>

    <!-- Update available banner -->
    <div
      v-if="needRefresh"
      class="flex items-center justify-between gap-3 bg-brand-700 px-4 py-2 text-sm"
    >
      <span>A new version is available.</span>
      <button class="rounded-lg bg-white/20 px-3 py-1 font-semibold" @click="updateServiceWorker(true)">
        Reload
      </button>
    </div>

    <!-- Routed page -->
    <main class="flex-1 px-4 pb-28 pt-4">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <!-- Bottom navigation (mobile-first) -->
    <nav
      class="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-white/5 bg-ink-900/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-[11px] font-medium text-slate-400"
        active-class="!text-brand-400"
      >
        <span class="text-lg leading-none">{{ item.icon }}</span>
        {{ item.label }}
      </RouterLink>
      <RouterLink
        to="/create"
        class="absolute -top-6 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-brand-600 text-2xl font-light text-white shadow-lg shadow-brand-900/40 active:scale-95"
        :class="{ 'ring-4 ring-brand-500/30': route.name === 'create' }"
        aria-label="Create event"
      >
        +
      </RouterLink>
    </nav>

    <!-- Toast host -->
    <div class="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 px-4">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto w-full max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
        :class="{
          'bg-ink-700 text-slate-100': t.type === 'info',
          'bg-emerald-600 text-white': t.type === 'success',
          'bg-red-600 text-white': t.type === 'error',
        }"
        @click="ui.removeToast(t.id)"
      >
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
