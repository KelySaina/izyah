<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    subtitle?: string;
  }>(),
  { icon: '✨' },
);
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div class="mb-3 text-5xl">{{ icon }}</div>
    <h3 class="text-base font-semibold text-slate-100">{{ title }}</h3>
    <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
