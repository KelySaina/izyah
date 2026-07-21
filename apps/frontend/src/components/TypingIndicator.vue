<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ names: string[] }>();

const label = computed(() => {
  const verb = props.names.length > 1 ? 'are' : 'is';
  return `${props.names.join(', ')} ${verb} typing`;
});
</script>

<template>
  <div
    v-if="names.length"
    class="flex items-center gap-2 px-3 py-1.5 text-xs text-fg-2"
    aria-live="polite"
  >
    <span class="truncate">{{ label }}</span>
    <span class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-3 [animation-delay:0ms]" />
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-3 [animation-delay:150ms]" />
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-3 [animation-delay:300ms]" />
    </span>
  </div>
</template>
