import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api';
import { on } from '@/services/socketService';
import type { NotificationDTO } from '@/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationDTO[]>([]);
  const unread = ref(0);
  const loading = ref(false);

  let initPromise: Promise<void> | null = null;

  /** Idempotent: safe to call on every app boot once identity is ready. Lives
   *  for the app's lifetime, so the socket subscription is never torn down. */
  function init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      loading.value = true;
      try {
        const res = await api.notifications.list();
        items.value = res.notifications;
        unread.value = res.unread;
      } finally {
        loading.value = false;
      }
      on<NotificationDTO>('notification:new', (n) => {
        items.value = [n, ...items.value];
        unread.value++;
      });
    })();
    return initPromise;
  }

  async function markRead(id: string): Promise<void> {
    const target = items.value.find((n) => n.id === id);
    if (!target || target.read) return;
    target.read = true;
    unread.value = Math.max(0, unread.value - 1);
    try {
      await api.notifications.read(id);
    } catch {
      // Best-effort — local state already reflects "read"; a refresh reconciles.
    }
  }

  async function markAllRead(): Promise<void> {
    if (unread.value === 0) return;
    items.value.forEach((n) => (n.read = true));
    unread.value = 0;
    try {
      await api.notifications.readAll();
    } catch {
      /* best-effort */
    }
  }

  return { items, unread, loading, init, markRead, markAllRead };
});
