<script setup lang="ts">
import { type Component } from 'vue';
import { Sparkles } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    icon?: Component;
    title: string;
    subtitle?: string;
  }>(),
  { icon: undefined, subtitle: undefined },
);
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div class="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-accent">
      <component :is="icon ?? Sparkles" :size="30" :stroke-width="1.75" />
    </div>
    <h3 class="text-base font-bold text-fg">{{ title }}</h3>
    <p v-if="subtitle" class="mt-1 max-w-[16rem] text-sm text-fg-3">{{ subtitle }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
