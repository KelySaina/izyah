<script setup lang="ts">
import { computed } from 'vue';
import { formatDayMonth } from '@/lib/format';

const props = defineProps<{ date: string }>();

const parts = computed(() => formatDayMonth(props.date));
</script>

<template>
  <div
    class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line/10 bg-surface-2"
  >
    <span class="text-[10px] font-bold uppercase tracking-wide text-accent">{{ parts.month }}</span>
    <span class="text-xl font-bold leading-none text-fg">{{ parts.day }}</span>
  </div>
</template>
