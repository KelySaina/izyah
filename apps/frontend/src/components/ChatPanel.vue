<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { MessageCircle, Send } from 'lucide-vue-next';
import OnlineBadge from '@/components/OnlineBadge.vue';
import MessageBubble from '@/components/MessageBubble.vue';
import TypingIndicator from '@/components/TypingIndicator.vue';
import { useChatStore } from '@/stores/chat';
import { useIdentityStore } from '@/stores/identity';

const props = defineProps<{ eventId: string }>();

const chat = useChatStore();
const identity = useIdentityStore();

const draft = ref('');
const listEl = ref<HTMLDivElement | null>(null);
let typingTimer: ReturnType<typeof setTimeout> | undefined;

function scrollToBottom(): void {
  const el = listEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

// Auto-scroll to the newest message when the list grows.
watch(
  () => chat.messages.length,
  () => {
    void nextTick(scrollToBottom);
  },
);

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

onMounted(async () => {
  await chat.open(props.eventId);
  void nextTick(scrollToBottom);
});

onBeforeUnmount(() => {
  clearTimeout(typingTimer);
  chat.close();
});
</script>

<template>
  <div class="card flex h-[70vh] flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-line/10 px-3 py-2">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-fg">
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
