<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, type Component } from 'vue';
import { MessageCircle, ListChecks, BarChart3, X } from 'lucide-vue-next';
import ChatPanel from '@/components/ChatPanel.vue';
import TaskList from '@/components/TaskList.vue';
import PollList from '@/components/PollList.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import { useChatStore } from '@/stores/chat';
import { useKeyboardInset } from '@/composables/useKeyboardInset';

/**
 * Bottom sheet housing Chat, Tasks and Polls for the currently viewed event.
 * The event's chat is joined for the whole time its detail page is open (see
 * EventDetailView) so presence + unread tracking work even while this sheet
 * is closed — opening it just surfaces the already-live conversation.
 */
const props = defineProps<{ eventId?: string | null }>();
const isOpen = defineModel<boolean>({ default: false });

const chat = useChatStore();

// Lift the sheet above the on-screen keyboard so the message input stays
// visible (see useKeyboardInset — the cross-browser fallback for platforms that
// ignore interactive-widget=resizes-content, e.g. iOS Safari).
const { inset: keyboardInset } = useKeyboardInset();

type InnerTab = 'chat' | 'tasks' | 'polls';
const innerTab = ref<InnerTab>('chat');
const innerTabs: { key: InnerTab; label: string; icon: Component }[] = [
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'polls', label: 'Polls', icon: BarChart3 },
];

function close(): void {
  isOpen.value = false;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) close();
}
onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
watch(
  isOpen,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      innerTab.value = 'chat';
      chat.markRead();
    }
  },
  { immediate: true },
);
// Keep the unread badge at zero for as long as the sheet stays open.
watch(
  () => chat.messages.length,
  () => {
    if (isOpen.value) chat.markRead();
  },
);
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center"
        :style="{ paddingBottom: keyboardInset ? `${keyboardInset}px` : undefined }"
        role="dialog"
        aria-modal="true"
        aria-label="Chat"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />
        <!-- max-h-full caps the sheet to the space left above the keyboard (the
             overlay's content box shrinks by keyboardInset), so it never runs
             behind it; items-end keeps it flush to that reduced bottom. -->
        <div
          class="relative flex h-[75vh] max-h-full w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line/10 bg-surface pb-[env(safe-area-inset-bottom)] shadow-card animate-pop-in"
        >
          <div class="flex items-center justify-between gap-2 border-b border-line/10 px-3 py-2.5">
            <div class="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button
                v-for="t in innerTabs"
                :key="t.key"
                type="button"
                class="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition"
                :class="innerTab === t.key ? 'bg-brand-500 text-ink-900' : 'bg-surface-2 text-fg-2'"
                @click="innerTab = t.key"
              >
                <component :is="t.icon" :size="14" :stroke-width="2.25" /> {{ t.label }}
              </button>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <OnlineBadge :count="chat.online" />
              <button
                type="button"
                class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2"
                aria-label="Close"
                @click="close"
              >
                <X :size="18" />
              </button>
            </div>
          </div>

          <ChatPanel
            v-if="innerTab === 'chat'"
            :show-header="false"
            class="!h-auto flex-1 !rounded-none !border-0 !shadow-none"
          />
          <div v-else class="flex-1 overflow-y-auto p-3">
            <TaskList v-if="innerTab === 'tasks' && props.eventId" :event-id="props.eventId" />
            <PollList v-else-if="props.eventId" :event-id="props.eventId" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
