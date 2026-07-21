<script setup lang="ts">
import { type Component } from 'vue';
import { Check, HelpCircle, X } from 'lucide-vue-next';
import type { RsvpCounts, RsvpStatus } from '@/types';

defineProps<{
  status?: RsvpStatus | null;
  counts?: RsvpCounts;
}>();

const emit = defineEmits<{ (e: 'change', status: RsvpStatus): void }>();

const options: { value: RsvpStatus; label: string; icon: Component; countKey: keyof RsvpCounts }[] =
  [
    { value: 'GOING', label: 'Going', icon: Check, countKey: 'going' },
    { value: 'MAYBE', label: 'Maybe', icon: HelpCircle, countKey: 'maybe' },
    { value: 'NOT_GOING', label: "Can't go", icon: X, countKey: 'notGoing' },
  ];
</script>

<template>
  <div class="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface p-1.5">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition active:scale-[0.97]"
      :class="
        opt.value === status
          ? 'bg-brand-500 text-ink-900 shadow-glow'
          : 'text-fg-2 hover:bg-surface-2'
      "
      :aria-pressed="opt.value === status"
      @click="emit('change', opt.value)"
    >
      <component :is="opt.icon" :size="18" :stroke-width="2.5" />
      <span>{{ opt.label }}</span>
      <span v-if="counts" class="text-[10px] font-semibold opacity-70">{{ counts[opt.countKey] }}</span>
    </button>
  </div>
</template>
