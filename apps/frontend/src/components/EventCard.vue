<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { MapPin, Users } from 'lucide-vue-next';
import DateBadge from '@/components/DateBadge.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import type { EventDTO } from '@/types';

defineProps<{ event: EventDTO }>();
</script>

<template>
  <RouterLink
    :to="'/event/' + event.slug"
    class="card block overflow-hidden transition active:scale-[0.99] hover:border-line/20"
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
        <h3 class="truncate font-display font-semibold text-fg">{{ event.title }}</h3>
        <p v-if="event.location" class="mt-1 flex items-center gap-1 truncate text-sm text-fg-2">
          <MapPin :size="13" class="shrink-0 text-fg-3" /> {{ event.location }}
        </p>
        <div class="mt-2 flex items-center gap-3 text-xs text-fg-2">
          <span class="flex items-center gap-1">
            <Users :size="13" class="text-accent" /> {{ event.counts.going }} going
          </span>
          <OnlineBadge v-if="event.onlineCount" :count="event.onlineCount" />
        </div>
      </div>
    </div>
  </RouterLink>
</template>
