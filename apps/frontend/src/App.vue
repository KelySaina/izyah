<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import {
  Home as HomeIcon,
  CalendarDays,
  User as UserIcon,
  Plus,
  RefreshCw,
  MessageCircle,
  Bell,
} from 'lucide-vue-next';
import Avatar from '@/components/Avatar.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ChatSheet from '@/components/ChatSheet.vue';
import NotificationsSheet from '@/components/NotificationsSheet.vue';
import UnreadBadge from '@/components/UnreadBadge.vue';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { useChatStore } from '@/stores/chat';
import { useEventsStore } from '@/stores/events';
import { useNotificationsStore } from '@/stores/notifications';

const identity = useIdentityStore();
const ui = useUiStore();
const chat = useChatStore();
const events = useEventsStore();
const notifications = useNotificationsStore();
const route = useRoute();

const notificationsOpen = ref(false);
const onEventPage = computed(() => route.name === 'event');
const currentEventId = computed(() => events.current?.id ?? null);

// PWA update lifecycle.
const { needRefresh, updateServiceWorker } = useRegisterSW();

watch(
  () => identity.ready && !!identity.id,
  (canSubscribe) => {
    if (canSubscribe) notifications.init();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ui.setInstallPrompt(e as never);
  });
});
</script>

<template>
  <!-- Splash while the anonymous identity bootstraps -->
  <div v-if="!identity.ready" class="fixed inset-0 grid place-items-center bg-app text-center">
    <div class="flex flex-col items-center">
      <img src="/icons/logo_app.png" alt="Izy'Ah" class="w-40 animate-pop-in drop-shadow-[0_8px_30px_rgba(247,195,49,0.25)]" />
      <p class="mt-4 flex items-center gap-2 text-sm text-fg-3">
        <span class="h-1.5 w-1.5 animate-ping rounded-full bg-brand-500" />
        Getting things ready…
      </p>
    </div>
  </div>

  <div v-else class="mx-auto flex min-h-full max-w-md flex-col">
    <!-- Top bar -->
    <header
      class="sticky top-0 z-20 flex items-center justify-between border-b border-line/10 bg-app/80 px-4 py-3 backdrop-blur"
    >
      <RouterLink to="/" class="flex items-center gap-2">
        <img src="/icons/logo_app.png" alt="Izy'Ah" class="h-9 w-auto" />
        <span class="font-display text-lg font-bold tracking-tight">
          <span class="text-fg">IZY</span><span class="text-accent">'AH</span>
        </span>
      </RouterLink>
      <div class="flex items-center gap-1.5">
        <button
          v-if="onEventPage"
          class="relative grid h-11 w-11 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2"
          aria-label="Open chat"
          @click="chat.sheetOpen = true"
        >
          <MessageCircle :size="18" />
          <UnreadBadge :count="chat.unread" class="absolute -right-0.5 -top-0.5" />
        </button>
        <button
          class="relative grid h-11 w-11 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2"
          aria-label="Notifications"
          @click="notificationsOpen = true"
        >
          <Bell :size="18" />
          <UnreadBadge :count="notifications.unread" class="absolute -right-0.5 -top-0.5" />
        </button>
        <RouterLink to="/profile" aria-label="Your profile" class="ml-0.5">
          <Avatar :name="identity.displayName" :avatar="identity.avatar" :size="32" />
        </RouterLink>
      </div>
    </header>

    <!-- Update available banner -->
    <div
      v-if="needRefresh"
      class="flex items-center justify-between gap-3 bg-brand-500 px-4 py-2 text-sm font-medium text-ink-900"
    >
      <span class="flex items-center gap-2"><RefreshCw :size="15" /> A new version is available.</span>
      <button class="rounded-lg bg-black/15 px-3 py-1 font-semibold" @click="updateServiceWorker(true)">
        Reload
      </button>
    </div>

    <!-- Routed page -->
    <main class="flex-1 px-4 pb-32 pt-4">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <!-- Floating create button — parked above the top-right of the bottom bar,
         separate from the nav items so it never crowds or hides a label. -->
    <div class="pointer-events-none fixed bottom-0 left-1/2 z-40 h-0 w-full max-w-md -translate-x-1/2">
      <RouterLink
        to="/create"
        aria-label="Create event"
        class="pointer-events-auto absolute right-4 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-ink-900 shadow-glow ring-1 ring-black/5 transition active:scale-90"
      >
        <Plus :size="28" :stroke-width="2.75" />
      </RouterLink>
    </div>

    <!-- Bottom navigation: three destinations, evenly spaced. -->
    <nav
      class="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-line/10 bg-app/90 backdrop-blur"
    >
      <div class="grid grid-cols-3 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        <RouterLink v-slot="{ isActive }" to="/" class="flex flex-col items-center gap-1 py-1">
          <span class="flex h-8 items-center justify-center">
            <HomeIcon :size="22" :stroke-width="isActive ? 2.5 : 2" :class="isActive ? 'text-accent' : 'text-fg-2'" />
          </span>
          <span class="text-[10px] font-semibold" :class="isActive ? 'text-accent' : 'text-fg-3'">Home</span>
        </RouterLink>

        <RouterLink v-slot="{ isActive }" to="/dashboard" class="flex flex-col items-center gap-1 py-1">
          <span class="flex h-8 items-center justify-center">
            <CalendarDays :size="22" :stroke-width="isActive ? 2.5 : 2" :class="isActive ? 'text-accent' : 'text-fg-2'" />
          </span>
          <span class="text-[10px] font-semibold" :class="isActive ? 'text-accent' : 'text-fg-3'">Events</span>
        </RouterLink>

        <RouterLink v-slot="{ isActive }" to="/profile" class="flex flex-col items-center gap-1 py-1">
          <span class="flex h-8 items-center justify-center">
            <UserIcon :size="22" :stroke-width="isActive ? 2.5 : 2" :class="isActive ? 'text-accent' : 'text-fg-2'" />
          </span>
          <span class="text-[10px] font-semibold" :class="isActive ? 'text-accent' : 'text-fg-3'">You</span>
        </RouterLink>
      </div>
    </nav>

    <!-- Toast host -->
    <div class="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto w-full max-w-sm animate-pop-in rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
        :class="{
          'bg-surface-2 text-fg': t.type === 'info',
          'bg-emerald-600 text-white': t.type === 'success',
          'bg-red-600 text-white': t.type === 'error',
        }"
        @click="ui.removeToast(t.id)"
      >
        {{ t.message }}
      </div>
    </div>

    <!-- App-wide confirm dialog (replaces window.confirm) -->
    <ConfirmDialog />

    <!-- Chat / tasks / polls sheet for the event currently being viewed -->
    <ChatSheet v-model="chat.sheetOpen" :event-id="currentEventId" />

    <!-- Notifications sheet -->
    <NotificationsSheet v-model="notificationsOpen" />
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
