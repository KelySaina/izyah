<script setup lang="ts">
import Avatar from '@/components/Avatar.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import type { AttendeeDTO, RsvpCounts } from '@/types';

defineProps<{
  attendees: AttendeeDTO[];
  counts: RsvpCounts;
  online?: number;
}>();
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-400">Going {{ counts.going }} · Maybe {{ counts.maybe }}</p>
      <OnlineBadge :count="online ?? 0" />
    </div>
    <div class="flex flex-wrap gap-3">
      <div
        v-for="a in attendees"
        :key="a.user.id"
        class="relative"
        :title="a.user.displayName"
      >
        <Avatar :user="a.user" :size="36" />
        <span
          v-if="a.role === 'HOST'"
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-ink-900"
        >
          Host
        </span>
      </div>
    </div>
  </div>
</template>
