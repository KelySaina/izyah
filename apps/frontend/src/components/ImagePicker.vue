<script setup lang="ts">
import { computed } from 'vue';
import { ImagePlus, Camera, X } from 'lucide-vue-next';
import { useImageUpload } from '@/composables/useImageUpload';

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    kind?: 'cover' | 'avatar';
    label?: string;
  }>(),
  { modelValue: null, kind: 'cover', label: 'Cover photo' },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const { uploading, pickAndUpload } = useImageUpload(props.kind);

const preview = computed(() =>
  props.modelValue && /^(https?:|blob:)/.test(props.modelValue) ? props.modelValue : null,
);

async function choose(camera: boolean): Promise<void> {
  const url = await pickAndUpload(camera);
  if (url) emit('update:modelValue', url);
}

function remove(): void {
  emit('update:modelValue', '');
}
</script>

<template>
  <div>
    <span class="label">{{ label }}</span>
    <div class="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line/15 bg-surface-2">
      <img v-if="preview" :src="preview" alt="Cover preview" class="h-full w-full object-cover" />
      <div v-else class="flex h-full flex-col items-center justify-center gap-1.5 text-fg-3">
        <ImagePlus :size="26" />
        <span class="text-xs">No cover yet</span>
      </div>

      <div v-if="uploading" class="absolute inset-0 grid place-items-center bg-black/40">
        <div class="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>

      <button
        v-if="preview && !uploading"
        type="button"
        class="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white transition active:scale-90"
        aria-label="Remove cover"
        @click="remove"
      >
        <X :size="16" />
      </button>
    </div>

    <div class="mt-2 flex gap-2">
      <button type="button" class="btn-ghost flex-1 text-sm" :disabled="uploading" @click="choose(false)">
        <ImagePlus :size="16" /> Upload
      </button>
      <button type="button" class="btn-ghost flex-1 text-sm" :disabled="uploading" @click="choose(true)">
        <Camera :size="16" /> Take photo
      </button>
    </div>
  </div>
</template>
