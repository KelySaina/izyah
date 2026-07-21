<script setup lang="ts">
import { RouterLink } from 'vue-router';
import DateBadge from '@/components/DateBadge.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import type { EventDTO } from '@/types';

defineProps<{ event: EventDTO }>();
</script>

<template>
  <RouterLink
    :to="'/event/' + event.slug"
    class="card block overflow-hidden transition active:scale-[0.99]"
  >
    <img
      v-if="event.coverImage"
      :src="event.coverImage"
      :alt="event.title"
      class="h-32 w-full object-cover"
      loading="lazy"
    />
    <div class="flex gap-3 p-3">
      <DateBadge :date="event.date" />
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-semibold text-slate-100">{{ event.title }}</h3>
        <p v-if="event.location" class="mt-0.5 truncate text-sm text-slate-400">
          📍 {{ event.location }}
        </p>
        <div class="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>👥 {{ event.counts.going }} going</span>
          <OnlineBadge v-if="event.onlineCount" :count="event.onlineCount" />
        </div>
      </div>
    </div>
  </RouterLink>
</template>
