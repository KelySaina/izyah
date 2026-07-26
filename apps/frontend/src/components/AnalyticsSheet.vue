<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { BarChart3, X } from 'lucide-vue-next';
import BarChart from '@/components/BarChart.vue';
import { compactNumber } from '@/lib/format';
import type { AnalyticsKey, AnalyticsResult } from '@/types';

const props = defineProps<{
  title: string;
  keys: AnalyticsKey[];
  labels: Record<AnalyticsKey, string>;
  load: () => Promise<AnalyticsResult>;
}>();

const isOpen = defineModel<boolean>({ default: false });

const loading = ref(false);
const result = ref<AnalyticsResult | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const dates = computed(() => result.value?.daily.map((d) => d.date) ?? []);

const charts = computed(() => {
  if (!result.value) return [];
  return props.keys.map((key) => ({
    key,
    label: props.labels[key],
    value: result.value!.totals[key] ?? 0,
    values: result.value!.daily.map((d) => d.counts[key] ?? 0),
  }));
});

async function refresh(showLoading: boolean): Promise<void> {
  if (showLoading) loading.value = true;
  try {
    result.value = await props.load();
  } catch {
    if (showLoading) result.value = null;
    // A background refresh failing (e.g. a dropped connection) just keeps
    // showing the last good numbers instead of blanking the sheet.
  } finally {
    loading.value = false;
  }
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// Live while open: an immediate fetch, then a short poll so RSVPs/messages/etc
// landing while the host is looking at it show up without closing/reopening.
watch(isOpen, (open) => {
  stopPolling();
  if (!open) return;
  void refresh(true);
  pollTimer = setInterval(() => refresh(false), 5000);
});

onBeforeUnmount(stopPolling);

function close(): void {
  isOpen.value = false;
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />
        <div
          class="relative flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line/10 bg-surface pb-[env(safe-area-inset-bottom)] shadow-card animate-pop-in"
        >
          <div class="flex items-center justify-between border-b border-line/10 px-4 py-3">
            <h2 class="flex items-center gap-1.5 font-display text-base font-bold text-fg">
              <BarChart3 :size="17" class="text-accent" /> {{ title }}
            </h2>
            <button
              type="button"
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2"
              aria-label="Close"
              @click="close"
            >
              <X :size="18" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <p v-if="loading" class="p-4 text-center text-sm text-fg-2">Loading…</p>
            <p v-else-if="!result" class="p-4 text-center text-sm text-fg-2">
              Couldn't load analytics right now.
            </p>
            <div v-else class="space-y-4">
              <div v-for="chart in charts" :key="chart.key" class="rounded-xl bg-surface-2 p-3">
                <div class="mb-2 flex items-baseline justify-between">
                  <p class="text-xs font-medium text-fg-2">{{ chart.label }}</p>
                  <p class="text-lg font-bold text-fg">{{ compactNumber(chart.value) }}</p>
                </div>
                <BarChart :values="chart.values" :dates="dates" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
