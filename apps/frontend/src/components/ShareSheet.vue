<script setup lang="ts">
import { computed } from 'vue';
import { Link2, Share2, CalendarPlus, Download } from 'lucide-vue-next';
import { useUiStore } from '@/stores/ui';
import { downloadICS, googleCalendarUrl } from '@/lib/ics';
import type { EventDTO } from '@/types';

const props = defineProps<{ event: EventDTO }>();

const ui = useUiStore();

const shareUrl = computed(() => `${window.location.origin}/event/${props.event.slug}`);
const canNativeShare = computed(() => typeof navigator !== 'undefined' && 'share' in navigator);

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    ui.toast('Link copied', 'success');
  } catch {
    ui.toast('Could not copy link', 'error');
  }
}

async function nativeShare(): Promise<void> {
  try {
    await navigator.share({ title: props.event.title, url: shareUrl.value });
  } catch {
    /* user dismissed the share sheet */
  }
}
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <button type="button" class="flex flex-col items-center gap-1.5 rounded-xl bg-ink-800 py-3 text-[11px] font-medium text-slate-300 transition active:scale-95 hover:bg-ink-700" @click="copyLink">
      <Link2 :size="18" class="text-brand-400" /> Copy
    </button>
    <button
      v-if="canNativeShare"
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-xl bg-ink-800 py-3 text-[11px] font-medium text-slate-300 transition active:scale-95 hover:bg-ink-700"
      @click="nativeShare"
    >
      <Share2 :size="18" class="text-brand-400" /> Share
    </button>
    <a
      class="flex flex-col items-center gap-1.5 rounded-xl bg-ink-800 py-3 text-[11px] font-medium text-slate-300 transition active:scale-95 hover:bg-ink-700"
      :href="googleCalendarUrl(event)"
      target="_blank"
      rel="noopener noreferrer"
    >
      <CalendarPlus :size="18" class="text-brand-400" /> Calendar
    </a>
    <button type="button" class="flex flex-col items-center gap-1.5 rounded-xl bg-ink-800 py-3 text-[11px] font-medium text-slate-300 transition active:scale-95 hover:bg-ink-700" @click="downloadICS(event)">
      <Download :size="18" class="text-brand-400" /> .ics
    </button>
  </div>
</template>
