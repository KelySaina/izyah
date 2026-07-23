<script setup lang="ts">
import Skeleton from '@/components/Skeleton.vue';
</script>

<template>
  <!-- Mirrors EventDetailView's above-the-fold layout. -->
  <div class="space-y-6">
    <Skeleton class="-mx-4 -mt-4 h-48 w-[calc(100%+2rem)] !rounded-none" />

    <div class="flex items-start gap-3">
      <Skeleton class="h-14 w-14 shrink-0 rounded-xl" />
      <div class="min-w-0 flex-1 space-y-2.5">
        <Skeleton class="h-6 w-2/3" />
        <Skeleton class="h-3.5 w-1/2" />
        <Skeleton class="h-3.5 w-1/3" />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Skeleton class="h-6 w-6 rounded-full" />
      <Skeleton class="h-3.5 w-32" />
    </div>

    <!-- RSVP buttons row -->
    <div class="grid grid-cols-3 gap-2">
      <Skeleton class="h-12 w-full rounded-2xl" />
      <Skeleton class="h-12 w-full rounded-2xl" />
      <Skeleton class="h-12 w-full rounded-2xl" />
    </div>

    <!-- Attendees card -->
    <div class="card space-y-3 p-4">
      <Skeleton class="h-4 w-28" />
      <div class="flex gap-2">
        <Skeleton class="h-9 w-9 rounded-full" />
        <Skeleton class="h-9 w-9 rounded-full" />
        <Skeleton class="h-9 w-9 rounded-full" />
      </div>
    </div>
  </div>
</template>
