<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Check, Clock, HelpCircle, X } from 'lucide-vue-next';
import type { RsvpCounts, RsvpStatus } from '@/types';

const props = defineProps<{
  status?: RsvpStatus | null;
  counts?: RsvpCounts;
  capacity?: number | null;
}>();

const emit = defineEmits<{ (e: 'change', status: RsvpStatus): void }>();

const options: { value: RsvpStatus; label: string; icon: Component; countKey: keyof RsvpCounts }[] =
  [
    { value: 'GOING', label: 'Going', icon: Check, countKey: 'going' },
    { value: 'MAYBE', label: 'Maybe', icon: HelpCircle, countKey: 'maybe' },
    { value: 'NOT_GOING', label: "Can't go", icon: X, countKey: 'notGoing' },
  ];

const isWaitlisted = computed(() => props.status === 'WAITLIST');
</script>

<template>
  <div class="space-y-2">
    <div class="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface p-1.5">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition active:scale-[0.97]"
        :class="
          opt.value === status || (opt.value === 'GOING' && isWaitlisted)
            ? 'bg-brand-500 text-ink-900 shadow-glow'
            : 'text-fg-2 hover:bg-surface-2'
        "
        :aria-pressed="opt.value === status"
        @click="emit('change', opt.value)"
      >
        <Clock v-if="opt.value === 'GOING' && isWaitlisted" :size="18" :stroke-width="2.5" />
        <component :is="opt.icon" v-else :size="18" :stroke-width="2.5" />
        <span>{{ opt.value === 'GOING' && isWaitlisted ? 'Waitlisted' : opt.label }}</span>
        <span v-if="counts" class="text-[10px] font-semibold opacity-70">{{ counts[opt.countKey] }}</span>
      </button>
    </div>
    <p v-if="isWaitlisted" class="text-center text-xs text-fg-3">
      You're on the waitlist — we'll notify you if a spot opens up.
    </p>
    <p v-else-if="capacity != null && counts" class="text-center text-xs text-fg-3">
      {{ counts.going }} / {{ capacity }} going{{ counts.waitlist > 0 ? ` · ${counts.waitlist} waitlisted` : '' }}
    </p>
  </div>
</template>
