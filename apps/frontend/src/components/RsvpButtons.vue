<script setup lang="ts">
import type { RsvpCounts, RsvpStatus } from '@/types';

defineProps<{
  status?: RsvpStatus | null;
  counts?: RsvpCounts;
}>();

const emit = defineEmits<{ (e: 'change', status: RsvpStatus): void }>();

const options: { value: RsvpStatus; label: string; icon: string; countKey: keyof RsvpCounts }[] = [
  { value: 'GOING', label: 'Going', icon: '✅', countKey: 'going' },
  { value: 'MAYBE', label: 'Maybe', icon: '🤔', countKey: 'maybe' },
  { value: 'NOT_GOING', label: 'Can’t go', icon: '🚫', countKey: 'notGoing' },
];
</script>

<template>
  <div class="grid grid-cols-3 gap-1 rounded-2xl bg-ink-700 p-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition active:scale-[0.98]"
      :class="opt.value === status ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-ink-600'"
      @click="emit('change', opt.value)"
    >
      <span class="text-base leading-none">{{ opt.icon }}</span>
      <span>{{ opt.label }}</span>
      <span v-if="counts" class="text-[10px] font-normal opacity-80">{{ counts[opt.countKey] }}</span>
    </button>
  </div>
</template>
