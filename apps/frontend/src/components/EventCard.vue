<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { MapPin, Users, Flame } from 'lucide-vue-next';
import DateBadge from '@/components/DateBadge.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import { eventTimeLabel } from '@/lib/format';
import type { EventDTO } from '@/types';

const props = defineProps<{ event: EventDTO; trending?: boolean }>();

const time = computed(() => eventTimeLabel(props.event.date));
const DATE_SIZE = 64;
</script>

<template>
  <RouterLink
    :to="'/event/' + event.slug"
    class="card block overflow-hidden transition active:scale-[0.99] hover:border-line/20"
    :class="time.tone === 'past' ? 'opacity-70' : ''"
  >
    <img
      v-if="event.coverImage"
      :src="event.coverImage"
      :alt="event.title"
      class="h-32 w-full object-cover"
      loading="lazy"
    />
    <div class="flex gap-3 p-3">
      <div class="flex flex-col items-center gap-1.5">
        <DateBadge :date="event.date" :size="DATE_SIZE" />
        <span
          class="rounded-full px-1 py-0.5 text-center text-[9px] font-bold uppercase leading-tight tracking-wide"
          :style="{ width: `${DATE_SIZE}px` }"
          :class="{
            'bg-brand-500 text-ink-900': time.tone === 'today',
            'bg-brand-500/15 text-accent': time.tone === 'soon',
            'bg-surface-2 text-fg-3': time.tone === 'past' || time.tone === 'later',
          }"
        >
          {{ time.text }}
        </span>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-display font-semibold text-fg">{{ event.title }}</h3>
        <p v-if="event.location" class="mt-1 flex items-center gap-1 truncate text-sm text-fg-2">
          <MapPin :size="13" class="shrink-0 text-fg-3" /> {{ event.location }}
        </p>
        <div class="mt-2 flex items-center gap-3 text-xs text-fg-2">
          <span class="flex items-center gap-1">
            <Users :size="13" class="text-accent" /> {{ event.counts.going }} going
          </span>
          <span v-if="trending" class="flex items-center gap-1 font-semibold text-orange-500">
            <Flame :size="13" /> Trending
          </span>
          <OnlineBadge v-if="event.onlineCount" :count="event.onlineCount" />
        </div>
      </div>
    </div>
  </RouterLink>
</template>
