<script setup lang="ts">
defineProps<{ count: number }>();
</script>

<template>
  <span
    v-if="count > 0"
    class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"
  >
    <span class="relative flex h-2 w-2">
      <span
        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
      ></span>
      <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
    </span>
    {{ count }} online
  </span>
</template>
