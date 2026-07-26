<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next';

/**
 * Fullscreen media viewer. Driven by v-model:index (a number to open at that
 * position, null to close). Navigates the whole `items` gallery with arrows,
 * keyboard (Esc / ← / →) and touch swipe. Teleported to <body> so no ancestor
 * (max-width container, backdrop-blur) can clip or mis-stack it.
 */
interface LightboxItem {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

const props = defineProps<{ items: LightboxItem[]; modelValue: number | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: number | null): void }>();

const isOpen = computed(() => props.modelValue !== null);
const count = computed(() => props.items.length);
const current = computed(() =>
  props.modelValue !== null ? (props.items[props.modelValue] ?? null) : null,
);

function close(): void {
  emit('update:modelValue', null);
}
function go(delta: number): void {
  if (props.modelValue === null || count.value === 0) return;
  emit('update:modelValue', (props.modelValue + delta + count.value) % count.value);
}

function onKey(e: KeyboardEvent): void {
  if (!isOpen.value) return;
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'ArrowRight') go(1);
}
onMounted(() => document.addEventListener('keydown', onKey));
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

// Horizontal swipe to navigate.
let startX = 0;
function onTouchStart(e: TouchEvent): void {
  startX = e.changedTouches[0]?.clientX ?? 0;
}
function onTouchEnd(e: TouchEvent): void {
  const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="isOpen && current"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="close"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <!-- Close -->
        <button
          type="button"
          class="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close"
          @click="close"
        >
          <X :size="22" />
        </button>

        <!-- Counter -->
        <div
          v-if="count > 1"
          class="absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white"
        >
          {{ (modelValue ?? 0) + 1 }} / {{ count }}
        </div>

        <!-- Prev -->
        <button
          v-if="count > 1"
          type="button"
          class="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Previous"
          @click="go(-1)"
        >
          <ChevronLeft :size="26" />
        </button>

        <!-- Media -->
        <img
          v-if="current.type === 'IMAGE'"
          :key="current.url"
          :src="current.url"
          alt="Event photo"
          class="max-h-[85vh] max-w-[92vw] animate-pop-in select-none object-contain"
        />
        <video
          v-else
          :key="current.url"
          :src="current.url"
          controls
          autoplay
          playsinline
          class="max-h-[85vh] max-w-[92vw] animate-pop-in object-contain"
        />

        <!-- Next -->
        <button
          v-if="count > 1"
          type="button"
          class="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Next"
          @click="go(1)"
        >
          <ChevronRight :size="26" />
        </button>
      </div>
    </transition>
  </Teleport>
</template>
