<script setup lang="ts">
import Skeleton from '@/components/Skeleton.vue';
</script>

<template>
  <!-- Mirrors EventCard's layout so content swaps in without a shift. -->
  <div class="card overflow-hidden">
    <Skeleton class="h-32 w-full !rounded-none" />
    <div class="flex gap-3 p-3">
      <Skeleton class="h-16 w-16 shrink-0 rounded-xl" />
      <div class="min-w-0 flex-1 space-y-2.5 py-1">
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-3 w-1/2" />
        <Skeleton class="h-3 w-1/3" />
      </div>
    </div>
  </div>
</template>
