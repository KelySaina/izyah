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
    <button type="button" class="flex flex-col items-center gap-1.5 rounded-xl bg-surface py-3 text-[11px] font-medium text-fg-2 transition active:scale-95 hover:bg-surface-2" @click="copyLink">
      <Link2 :size="18" class="text-accent" /> Copy
    </button>
    <button
      v-if="canNativeShare"
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-xl bg-surface py-3 text-[11px] font-medium text-fg-2 transition active:scale-95 hover:bg-surface-2"
      @click="nativeShare"
    >
      <Share2 :size="18" class="text-accent" /> Share
    </button>
    <a
      class="flex flex-col items-center gap-1.5 rounded-xl bg-surface py-3 text-[11px] font-medium text-fg-2 transition active:scale-95 hover:bg-surface-2"
      :href="googleCalendarUrl(event)"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Add to Google Calendar"
    >
      <CalendarPlus :size="18" class="text-accent" /> Google Cal
    </a>
    <button
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-xl bg-surface py-3 text-[11px] font-medium text-fg-2 transition active:scale-95 hover:bg-surface-2"
      aria-label="Download for Apple Calendar, Outlook, or other calendar apps"
      @click="downloadICS(event)"
    >
      <Download :size="18" class="text-accent" /> Other Cal
    </button>
  </div>
</template>
