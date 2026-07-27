<script setup lang="ts">
import { computed } from 'vue';
import { Check } from 'lucide-vue-next';
import Avatar from '@/components/Avatar.vue';
import OnlineBadge from '@/components/OnlineBadge.vue';
import type { AttendanceMode, AttendeeDTO, RsvpCounts } from '@/types';

const props = defineProps<{
  attendees: AttendeeDTO[];
  counts: RsvpCounts;
  online?: number;
  /** Only the host can toggle paid/checked-in — everyone else (and any
   *  NONE-mode event) just sees the plain avatar grid, unchanged. */
  isHost?: boolean;
  attendanceMode?: AttendanceMode;
}>();

const emit = defineEmits<{
  (e: 'toggle', userId: string, patch: { paid?: boolean; checkedIn?: boolean }): void;
}>();

const STATUS_LABEL: Record<AttendeeDTO['status'], string> = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  NOT_GOING: "Can't go",
  WAITLIST: 'Waitlist',
};

function isToggled(a: AttendeeDTO): boolean {
  return props.attendanceMode === 'MIN_PAF' ? a.paid : a.checkedIn;
}

function toggleLabel(a: AttendeeDTO): string {
  if (props.attendanceMode === 'MIN_PAF') return a.paid ? 'Paid' : 'Mark paid';
  return a.checkedIn ? 'Checked in' : 'Check in';
}

function onToggle(a: AttendeeDTO): void {
  const next = !isToggled(a);
  emit('toggle', a.user.id, props.attendanceMode === 'MIN_PAF' ? { paid: next } : { checkedIn: next });
}

const showRows = computed(
  () => !!props.isHost && !!props.attendanceMode && props.attendanceMode !== 'NONE',
);

// Avatar row caps how many faces it shows and rolls the rest into a "+N" chip,
// kept to a single line that spreads across the full card width. Capped at 6 so
// six avatars + the chip still fit without overlap on the narrowest phones.
const MAX_AVATARS = 6;
const shownAttendees = computed(() => props.attendees.slice(0, MAX_AVATARS));
const overflowCount = computed(() => Math.max(0, props.attendees.length - shownAttendees.value.length));
const slotCount = computed(() => shownAttendees.value.length + (overflowCount.value > 0 ? 1 : 0));
// Only spread edge-to-edge once there are enough faces to fill the row; a
// couple of avatars flung to opposite corners looks broken, so those stay
// left-aligned with a normal gap.
const spread = computed(() => slotCount.value >= 4);
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-fg-2">
        Going {{ counts.going }} · Maybe {{ counts.maybe }}<template v-if="counts.waitlist > 0">
          · Waitlist {{ counts.waitlist }}</template
        >
      </p>
      <OnlineBadge :count="online ?? 0" />
    </div>

    <!-- Host view with paid/checked-in tracking -->
    <ul v-if="showRows" class="divide-y divide-line/10">
      <li v-for="a in attendees" :key="a.user.id" class="flex items-center gap-3 py-2">
        <Avatar :user="a.user" :size="36" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg">{{ a.user.displayName }}</p>
          <p class="text-xs text-fg-3">
            {{ STATUS_LABEL[a.status] }}<template v-if="a.role === 'HOST'"> · Host</template>
          </p>
        </div>
        <button
          type="button"
          class="btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
          :class="isToggled(a) ? '!text-accent' : ''"
          @click="onToggle(a)"
        >
          <Check v-if="isToggled(a)" :size="14" />
          {{ toggleLabel(a) }}
        </button>
      </li>
    </ul>

    <!-- Default: single line of avatars spread across the card + "+N" chip.
         Wrappers are `flex` so the inline-grid Avatar has no baseline gap and
         the row sits perfectly straight. -->
    <div v-else class="flex items-center" :class="spread ? 'justify-between' : 'gap-3'">
      <div v-for="a in shownAttendees" :key="a.user.id" class="relative flex" :title="a.user.displayName">
        <Avatar :user="a.user" :size="36" />
        <span
          v-if="a.role === 'HOST'"
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-ink-900"
        >
          Host
        </span>
      </div>
      <div
        v-if="overflowCount > 0"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-fg-2"
        :title="`${overflowCount} more`"
      >
        +{{ overflowCount }}
      </div>
    </div>
  </div>
</template>
