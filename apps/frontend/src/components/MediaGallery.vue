<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, ApiError } from '@/services/api';
import { pickPhoto } from '@/services/cameraService';
import { useUiStore } from '@/stores/ui';
import EmptyState from '@/components/EmptyState.vue';
import type { MediaDTO } from '@/types';

const props = defineProps<{ eventId: string }>();

const ui = useUiStore();

const media = ref<MediaDTO[]>([]);
const loading = ref(true);
const uploading = ref(false);

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

onMounted(async () => {
  try {
    media.value = await api.media.list(props.eventId);
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    loading.value = false;
  }
});

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
      {{ uploading ? 'Uploading…' : '📷 Add photo/video' }}
    </button>

    <p v-if="loading" class="text-sm text-slate-400">Loading media…</p>

    <EmptyState
      v-else-if="media.length === 0 && !uploading"
      icon="🖼️"
      title="No photos yet"
      subtitle="Share the first snapshot from this event."
    />

    <div v-else class="grid grid-cols-3 gap-1">
      <!-- Optimistic uploading placeholder -->
      <div
        v-if="uploading"
        class="flex aspect-square animate-pulse items-center justify-center rounded-lg bg-ink-700 text-xs text-slate-400"
      >
        Uploading…
      </div>

      <div
        v-for="item in media"
        :key="item.id"
        class="relative aspect-square overflow-hidden rounded-lg bg-ink-700"
      >
        <img
          v-if="item.type === 'IMAGE'"
          :src="item.url"
          loading="lazy"
          alt="Event photo"
          class="h-full w-full object-cover"
        />
        <video v-else :src="item.url" controls class="h-full w-full object-cover" />

        <span
          v-if="item.status !== 'READY'"
          class="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
        >
          {{ item.status }}
        </span>
      </div>
    </div>
  </section>
</template>
