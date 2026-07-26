<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { MessageCircle, Send } from 'lucide-vue-next';
import OnlineBadge from '@/components/OnlineBadge.vue';
import MessageBubble from '@/components/MessageBubble.vue';
import TypingIndicator from '@/components/TypingIndicator.vue';
import { useChatStore } from '@/stores/chat';
import { useIdentityStore } from '@/stores/identity';

/**
 * Presentational — the parent view owns the `chat.open()`/`close()` lifecycle
 * (tied to viewing the event, not to this component's mount) so presence and
 * unread tracking keep working while the chat sheet is closed.
 */
withDefaults(defineProps<{ showHeader?: boolean }>(), { showHeader: true });

const chat = useChatStore();
const identity = useIdentityStore();

const draft = ref('');
const listEl = ref<HTMLDivElement | null>(null);
let typingTimer: ReturnType<typeof setTimeout> | undefined;
// Set while prepending older messages, so the length watcher below doesn't
// yank the scroll position back down to the bottom.
let loadingOlderScroll = false;

function scrollToBottom(): void {
  const el = listEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

// Auto-scroll to the newest message when the list grows (new/sent message).
watch(
  () => chat.messages.length,
  () => {
    if (loadingOlderScroll) return;
    void nextTick(scrollToBottom);
  },
);

async function onLoadOlder(): Promise<void> {
  const el = listEl.value;
  const prevScrollHeight = el?.scrollHeight ?? 0;
  const prevScrollTop = el?.scrollTop ?? 0;
  loadingOlderScroll = true;
  try {
    await chat.loadOlder();
    await nextTick();
    if (el) el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
  } finally {
    loadingOlderScroll = false;
  }
}

function onInput(): void {
  chat.setTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => chat.setTyping(false), 1500);
}

function send(): void {
  const text = draft.value.trim();
  if (!text) return;
  chat.send(text);
  draft.value = '';
  clearTimeout(typingTimer);
  chat.setTyping(false);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

void nextTick(scrollToBottom);

onBeforeUnmount(() => clearTimeout(typingTimer));
</script>

<template>
  <div class="card flex h-[70vh] flex-col overflow-hidden">
    <!-- Header -->
    <div v-if="showHeader" class="flex items-center justify-between border-b border-line/10 px-3 py-2">
      <h3 class="flex items-center gap-1.5 text-sm font-bold text-fg">
        <MessageCircle :size="16" class="text-accent" /> Chat
      </h3>
      <OnlineBadge :count="chat.online" />
    </div>

    <!-- Message list -->
    <div ref="listEl" class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
      <div
        v-if="chat.loading"
        class="grid h-full place-items-center text-sm text-fg-3"
      >
        Loading messages…
      </div>

      <div
        v-else-if="!chat.messages.length"
        class="grid h-full place-items-center px-6 text-center text-sm text-fg-3"
      >
        <span>No messages yet — say hi 👋</span>
      </div>

      <div v-if="chat.hasMore && chat.messages.length > 0" class="pb-1 text-center">
        <button
          type="button"
          class="text-xs font-semibold text-fg-2 hover:text-fg disabled:opacity-50"
          :disabled="chat.loadingOlder"
          @click="onLoadOlder"
        >
          {{ chat.loadingOlder ? 'Loading…' : 'Load older messages' }}
        </button>
      </div>

      <MessageBubble
        v-for="m in chat.messages"
        :key="m.id"
        :message="m"
        :mine="m.user.id === identity.id"
      />
    </div>

    <!-- Typing indicator -->
    <TypingIndicator :names="chat.typingNames" />

    <!-- Composer -->
    <div class="flex items-end gap-2 border-t border-line/10 p-2">
      <textarea
        v-model="draft"
        rows="1"
        class="input max-h-28 flex-1 resize-none"
        maxlength="2000"
        placeholder="Message…"
        aria-label="Message"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-ink-900 transition active:scale-95 disabled:opacity-40"
        :disabled="!draft.trim()"
        aria-label="Send message"
        @click="send"
      >
        <Send :size="18" />
      </button>
    </div>
  </div>
</template>
