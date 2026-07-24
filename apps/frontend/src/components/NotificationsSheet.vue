<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, CalendarCheck, Check, ClipboardCheck, X } from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';
import { useNotificationsStore } from '@/stores/notifications';
import { relativeTime } from '@/lib/format';
import type { NotificationDTO } from '@/types';

const isOpen = defineModel<boolean>({ default: false });

const notifications = useNotificationsStore();
const router = useRouter();

function close(): void {
  isOpen.value = false;
}

interface RsvpGoingPayload {
  eventTitle: string;
  eventSlug: string;
  displayName: string;
}
interface WaitlistPromotedPayload {
  eventTitle: string;
  eventSlug: string;
}
interface TaskClaimedPayload {
  eventTitle: string;
  eventSlug: string;
  taskTitle: string;
  displayName: string;
}

function icon(n: NotificationDTO) {
  if (n.type === 'task_claimed') return ClipboardCheck;
  if (n.type === 'waitlist_promoted') return CalendarCheck;
  return Bell;
}

function text(n: NotificationDTO): string {
  if (n.type === 'rsvp_going') {
    const p = n.payload as RsvpGoingPayload;
    return `${p.displayName} is going to "${p.eventTitle}"`;
  }
  if (n.type === 'waitlist_promoted') {
    const p = n.payload as WaitlistPromotedPayload;
    return `You're off the waitlist for "${p.eventTitle}" — you're in!`;
  }
  if (n.type === 'task_claimed') {
    const p = n.payload as TaskClaimedPayload;
    return `${p.displayName} claimed "${p.taskTitle}" for "${p.eventTitle}"`;
  }
  return 'New notification';
}

function slugOf(n: NotificationDTO): string | undefined {
  return (n.payload as { eventSlug?: string } | null)?.eventSlug;
}

const sorted = computed(() =>
  [...notifications.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
);

async function onSelect(n: NotificationDTO): Promise<void> {
  await notifications.markRead(n.id);
  const slug = slugOf(n);
  close();
  if (slug) void router.push(`/event/${slug}`);
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />
        <div
          class="relative flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line/10 bg-surface pb-[env(safe-area-inset-bottom)] shadow-card animate-pop-in"
        >
          <div class="flex items-center justify-between border-b border-line/10 px-4 py-3">
            <h2 class="flex items-center gap-1.5 font-display text-base font-bold text-fg">
              <Bell :size="17" class="text-accent" /> Notifications
            </h2>
            <div class="flex items-center gap-3">
              <button
                v-if="notifications.unread > 0"
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-fg-2 hover:text-fg"
                @click="notifications.markAllRead()"
              >
                <Check :size="14" /> Mark all read
              </button>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2"
                aria-label="Close"
                @click="close"
              >
                <X :size="18" />
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <p v-if="notifications.loading" class="p-4 text-center text-sm text-fg-2">Loading…</p>

            <EmptyState
              v-else-if="sorted.length === 0"
              :icon="Bell"
              title="No notifications yet"
              subtitle="RSVPs, claimed tasks and waitlist spots will show up here."
            />

            <button
              v-for="n in sorted"
              :key="n.id"
              type="button"
              class="flex w-full items-start gap-3 border-b border-line/10 px-4 py-3 text-left transition hover:bg-surface-2"
              @click="onSelect(n)"
            >
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                :class="n.read ? 'bg-surface-2 text-fg-3' : 'bg-brand-500/15 text-accent'"
              >
                <component :is="icon(n)" :size="16" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm leading-snug" :class="n.read ? 'text-fg-2' : 'text-fg font-medium'">
                  {{ text(n) }}
                </span>
                <span class="mt-0.5 block text-xs text-fg-3">{{ relativeTime(n.createdAt) }}</span>
              </span>
              <span v-if="!n.read" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
