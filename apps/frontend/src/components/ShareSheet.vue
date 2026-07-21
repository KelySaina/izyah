<script setup lang="ts">
import { computed } from 'vue';
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
  <div class="flex flex-wrap gap-2">
    <button type="button" class="btn-ghost text-xs" @click="copyLink">🔗 Copy link</button>
    <button
      v-if="canNativeShare"
      type="button"
      class="btn-ghost text-xs"
      @click="nativeShare"
    >
      📤 Share
    </button>
    <a
      class="btn-ghost text-xs"
      :href="googleCalendarUrl(event)"
      target="_blank"
      rel="noopener noreferrer"
    >
      📅 Google Calendar
    </a>
    <button type="button" class="btn-ghost text-xs" @click="downloadICS(event)">
      ⬇︎ .ics
    </button>
  </div>
</template>
