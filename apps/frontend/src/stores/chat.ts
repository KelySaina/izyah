import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { api } from '@/services/api';
import {
  joinEvent,
  leaveEvent,
  on,
  sendMessage,
  sendTyping,
} from '@/services/socketService';
import { useEventsStore } from './events';
import { useIdentityStore } from './identity';
import type { MessageDTO, PresenceUpdate, RsvpUpdate, TypingUpdate } from '@/types';

// Matches the backend's default page size (message.schemas.ts) — used only
// to detect a short last page, not sent explicitly.
const PAGE_SIZE = 50;

export const useChatStore = defineStore('chat', () => {
  const messages = ref<MessageDTO[]>([]);
  const online = ref(0);
  const loading = ref(false);
  const loadingOlder = ref(false);
  const hasMore = ref(true);
  /** Messages from other people received since the chat UI was last opened. */
  const unread = ref(0);
  /** Whether the Chat/Tasks/Polls bottom sheet is open — lives here (not in
   *  App.vue) so any view can trigger it, e.g. a summary card on the event
   *  detail page, not just the header icon. */
  const sheetOpen = ref(false);

  const typingUsers = reactive<Record<string, string>>({}); // userId -> displayName
  const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  const typingNames = computed(() => Object.values(typingUsers));

  let activeEventId: string | null = null;
  let unsubscribers: Array<() => void> = [];

  function handleTyping(t: TypingUpdate): void {
    if (t.isTyping) {
      typingUsers[t.userId] = t.displayName;
      clearTimeout(typingTimers[t.userId]);
      typingTimers[t.userId] = setTimeout(() => {
        delete typingUsers[t.userId];
      }, 4000);
    } else {
      delete typingUsers[t.userId];
      clearTimeout(typingTimers[t.userId]);
    }
  }

  async function open(eventId: string): Promise<void> {
    close();
    activeEventId = eventId;
    loading.value = true;
    try {
      messages.value = await api.messages.list(eventId);
      hasMore.value = messages.value.length >= PAGE_SIZE;
    } finally {
      loading.value = false;
    }

    joinEvent(eventId);
    const events = useEventsStore();
    const identity = useIdentityStore();

    unsubscribers.push(
      on<MessageDTO>('chat:message', (m) => {
        if (m.eventId !== eventId) return;
        if (!messages.value.some((x) => x.id === m.id)) {
          messages.value.push(m);
          if (m.user.id !== identity.id) unread.value++;
        }
      }),
      on<PresenceUpdate>('presence:update', (p) => {
        if (p.eventId === eventId) {
          online.value = p.count;
          events.applyOnline(p.count);
        }
      }),
      on<TypingUpdate>('chat:typing', (t) => {
        if (t.eventId === eventId) handleTyping(t);
      }),
      on<RsvpUpdate>('rsvp:update', (r) => {
        if (r.eventId === eventId) events.applyCounts(r.counts);
      }),
    );
  }

  function close(): void {
    if (activeEventId) leaveEvent(activeEventId);
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    messages.value = [];
    online.value = 0;
    unread.value = 0;
    hasMore.value = true;
    activeEventId = null;
    for (const k of Object.keys(typingUsers)) delete typingUsers[k];
  }

  /** Call when the chat UI becomes visible to the user. */
  function markRead(): void {
    unread.value = 0;
  }

  /** Fetch the next page of older messages and prepend them. */
  async function loadOlder(): Promise<void> {
    if (!activeEventId || loadingOlder.value || !hasMore.value || messages.value.length === 0) {
      return;
    }
    loadingOlder.value = true;
    try {
      const oldest = messages.value[0]!.createdAt;
      const older = await api.messages.list(activeEventId, oldest);
      if (older.length < PAGE_SIZE) hasMore.value = false;
      const existingIds = new Set(messages.value.map((m) => m.id));
      messages.value.unshift(...older.filter((m) => !existingIds.has(m.id)));
    } finally {
      loadingOlder.value = false;
    }
  }

  function send(content: string): void {
    const trimmed = content.trim();
    if (activeEventId && trimmed) sendMessage(activeEventId, trimmed);
  }

  function setTyping(isTyping: boolean): void {
    if (activeEventId) sendTyping(activeEventId, isTyping);
  }

  return {
    messages,
    online,
    loading,
    loadingOlder,
    hasMore,
    unread,
    sheetOpen,
    typingNames,
    open,
    close,
    send,
    setTyping,
    markRead,
    loadOlder,
  };
});
