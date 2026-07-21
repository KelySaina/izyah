<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Compass } from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="pt-10">
    <EmptyState
      :icon="Compass"
      title="Page not found"
      subtitle="The page you're looking for doesn't exist or has moved."
    >
      <RouterLink to="/" class="btn-primary">Back home</RouterLink>
    </EmptyState>
  </div>
</template>
