<script setup lang="ts">
import { computed } from 'vue';
import { formatDayMonth } from '@/lib/format';

const props = withDefaults(defineProps<{ date: string; size?: number }>(), { size: 56 });

const parts = computed(() => formatDayMonth(props.date));
const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
const monthStyle = computed(() => ({ fontSize: `${Math.round(props.size * 0.18)}px` }));
const dayStyle = computed(() => ({ fontSize: `${Math.round(props.size * 0.36)}px` }));
</script>

<template>
  <div
    class="flex shrink-0 flex-col items-center justify-center rounded-xl border border-line/10 bg-surface-2"
    :style="boxStyle"
  >
    <span class="font-bold uppercase tracking-wide text-accent" :style="monthStyle">{{ parts.month }}</span>
    <span class="font-bold leading-none text-fg" :style="dayStyle">{{ parts.day }}</span>
  </div>
</template>
