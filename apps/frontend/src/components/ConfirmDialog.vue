<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useUiStore } from '@/stores/ui';

/**
 * Single app-wide confirm dialog, driven by `ui.confirm()`. Mounted once in
 * App.vue — the in-app replacement for window.confirm(). Escape / backdrop
 * click both resolve to false.
 */
const ui = useUiStore();

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && ui.confirmState) ui.resolveConfirm(false);
}
onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <transition name="fade">
    <div
      v-if="ui.confirmState"
      class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="ui.resolveConfirm(false)" />
      <div class="relative w-full max-w-sm animate-pop-in rounded-2xl border border-line/10 bg-surface p-5 shadow-card">
        <h3 v-if="ui.confirmState.title" class="font-display text-lg font-bold text-fg">
          {{ ui.confirmState.title }}
        </h3>
        <p class="mt-1 text-sm text-fg-2">{{ ui.confirmState.message }}</p>
        <div class="mt-5 flex gap-2">
          <button type="button" class="btn-ghost flex-1" @click="ui.resolveConfirm(false)">
            {{ ui.confirmState.cancelText ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="flex-1"
            :class="
              ui.confirmState.danger ? 'btn bg-red-600 text-white hover:bg-red-500' : 'btn-primary'
            "
            @click="ui.resolveConfirm(true)"
          >
            {{ ui.confirmState.confirmText ?? 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
