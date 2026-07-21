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
import type { MessageDTO, PresenceUpdate, RsvpUpdate, TypingUpdate } from '@/types';

export const useChatStore = defineStore('chat', () => {
  const messages = ref<MessageDTO[]>([]);
  const online = ref(0);
  const loading = ref(false);

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
    } finally {
      loading.value = false;
    }

    joinEvent(eventId);
    const events = useEventsStore();

    unsubscribers.push(
      on<MessageDTO>('chat:message', (m) => {
        if (m.eventId !== eventId) return;
        if (!messages.value.some((x) => x.id === m.id)) messages.value.push(m);
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
    for (const k of Object.keys(typingUsers)) delete typingUsers[k];
    activeEventId = null;
  }

  function send(content: string): void {
    const trimmed = content.trim();
    if (activeEventId && trimmed) sendMessage(activeEventId, trimmed);
  }

  function setTyping(isTyping: boolean): void {
    if (activeEventId) sendTyping(activeEventId, isTyping);
  }

  return { messages, online, loading, typingNames, open, close, send, setTyping };
});
