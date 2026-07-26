<script setup lang="ts">
import { computed, ref } from 'vue';
import { compactNumber } from '@/lib/format';

const props = defineProps<{ values: number[]; dates: string[] }>();

const max = computed(() => Math.max(1, ...props.values));
const selected = ref(props.values.length - 1);

const bars = computed(() =>
  props.values.map((v, i) => ({
    value: v,
    date: props.dates[i],
    // A floor keeps zero-value days tappable instead of collapsing to nothing.
    pct: Math.max(4, (v / max.value) * 100),
  })),
);

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
</script>

<template>
  <div>
    <p class="mb-1.5 text-xs text-fg-3">
      {{ shortDate(bars[selected]?.date) }} ·
      <span class="font-semibold text-fg">{{ compactNumber(bars[selected]?.value ?? 0) }}</span>
    </p>
    <div class="flex h-16 items-end gap-[3px] border-b border-line/15">
      <button
        v-for="(bar, i) in bars"
        :key="bar.date"
        type="button"
        class="min-w-0 flex-1 rounded-t transition-colors"
        :class="i === selected ? 'bg-accent' : 'bg-accent/25 hover:bg-accent/40'"
        :style="{ height: `${bar.pct}%` }"
        :aria-label="`${shortDate(bar.date)}: ${bar.value}`"
        @click="selected = i"
      />
    </div>
    <div class="mt-1 flex justify-between text-[10px] text-fg-3">
      <span>{{ shortDate(bars[0]?.date) }}</span>
      <span>{{ shortDate(bars[bars.length - 1]?.date) }}</span>
    </div>
  </div>
</template>
