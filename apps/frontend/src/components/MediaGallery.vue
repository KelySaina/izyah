<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { Camera, Image as ImageIcon, Play } from 'lucide-vue-next';
import { api, ApiError } from '@/services/api';
import { pickPhoto } from '@/services/cameraService';
import { useUiStore } from '@/stores/ui';
import EmptyState from '@/components/EmptyState.vue';
import Lightbox from '@/components/Lightbox.vue';
import type { MediaDTO } from '@/types';

// Matches the backend's default page size (media.schemas.ts) — used only to
// detect a short last page, not sent explicitly.
const PAGE_SIZE = 24;

const props = defineProps<{ eventId: string }>();

const ui = useUiStore();

const media = ref<MediaDTO[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
const uploading = ref(false);
/** Index of the media item open in the lightbox (null = closed). */
const lightboxIndex = ref<number | null>(null);
const sentinel = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const oldest = media.value.at(-1)?.createdAt;
    const batch = await api.media.list(props.eventId, oldest);
    if (batch.length < PAGE_SIZE) hasMore.value = false;
    media.value.push(...batch);
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    loadingMore.value = false;
  }
}

onMounted(async () => {
  try {
    media.value = await api.media.list(props.eventId);
    if (media.value.length < PAGE_SIZE) hasMore.value = false;
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    loading.value = false;
  }

  await nextTick();
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) void loadMore();
  });
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => observer?.disconnect());

async function add(): Promise<void> {
  if (uploading.value) return;
  let file: File | null = null;
  try {
    file = await pickPhoto();
  } catch (err) {
    ui.toast(errMsg(err), 'error');
    return;
  }
  if (!file) return;

  uploading.value = true;
  try {
    const item = await api.media.upload(props.eventId, file);
    media.value.unshift(item);
    ui.toast('Uploaded', 'success');
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <section class="space-y-3">
    <button type="button" class="btn-primary w-full" :disabled="uploading" @click="add">
      <Camera v-if="!uploading" :size="18" />
      {{ uploading ? 'Uploading…' : 'Add photo / video' }}
    </button>

    <p v-if="loading" class="text-sm text-fg-2">Loading media…</p>

    <EmptyState
      v-else-if="media.length === 0 && !uploading"
      :icon="ImageIcon"
      title="No photos yet"
      subtitle="Share the first snapshot from this event."
    />

    <div v-else class="grid grid-cols-3 gap-1">
      <!-- Optimistic uploading placeholder -->
      <div
        v-if="uploading"
        class="flex aspect-square animate-pulse items-center justify-center rounded-lg bg-surface-2 text-xs text-fg-2"
      >
        Uploading…
      </div>

      <button
        v-for="(item, i) in media"
        :key="item.id"
        type="button"
        class="group relative aspect-square overflow-hidden rounded-lg bg-surface-2 transition active:scale-[0.98]"
        @click="lightboxIndex = i"
      >
        <img
          v-if="item.type === 'IMAGE'"
          :src="item.url"
          loading="lazy"
          alt="Event photo"
          class="h-full w-full object-cover"
        />
        <template v-else>
          <video :src="item.url" preload="metadata" muted playsinline class="h-full w-full object-cover" />
          <!-- Play affordance — the video opens in the lightbox to actually play. -->
          <span class="absolute inset-0 grid place-items-center bg-black/25">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
              <Play :size="18" :fill="'currentColor'" />
            </span>
          </span>
        </template>

        <span
          v-if="item.status !== 'READY'"
          class="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {{ item.status }}
        </span>
      </button>
    </div>

    <!-- Infinite-scroll trigger — loads the next batch when it enters view. -->
    <div v-if="hasMore && !loading" ref="sentinel" class="h-1" />
    <p v-if="loadingMore" class="text-center text-xs text-fg-3">Loading more…</p>

    <Lightbox v-model="lightboxIndex" :items="media" />
  </section>
</template>
