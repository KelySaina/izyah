<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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

// "Who's coming" shows GOING + MAYBE only, so the faces match the "Going X ·
// Maybe Y" count above — never the odd declined/waitlisted row. The overflow
// number comes from the authoritative counts (also correct if the server ever
// caps how many rows it returns), so faces shown + "+N" == going + maybe.
const AVATAR_PX = 36;
const MAX_AVATARS = 10;
const coming = computed(() => props.attendees.filter((a) => a.status === 'GOING' || a.status === 'MAYBE'));
const comingTotal = computed(() => Math.max(props.counts.going + props.counts.maybe, coming.value.length));
const shownAttendees = computed(() => coming.value.slice(0, MAX_AVATARS));
const overflowCount = computed(() => Math.max(0, comingTotal.value - shownAttendees.value.length));
const slotCount = computed(() => shownAttendees.value.length + (overflowCount.value > 0 ? 1 : 0));

// Fill the full row width: measure it, then space the slots evenly. With a big
// guest list the spacing goes negative so faces overlap (capped at 50%) instead
// of overflowing or wrapping. A handful of guests stay left-aligned with a
// normal gap rather than being flung to opposite corners (see `spread`).
const rowEl = ref<HTMLElement | null>(null);
const rowWidth = ref(0);
let ro: ResizeObserver | null = null;
onMounted(() => {
  if (!rowEl.value) return;
  rowWidth.value = rowEl.value.clientWidth;
  ro = new ResizeObserver((entries) => {
    rowWidth.value = entries[0]?.contentRect.width ?? rowWidth.value;
  });
  ro.observe(rowEl.value);
});
onBeforeUnmount(() => ro?.disconnect());

const spread = computed(() => slotCount.value >= 4);
const stepMargin = computed(() => {
  const n = slotCount.value;
  if (!spread.value || n <= 1 || rowWidth.value <= 0) return 0;
  const gap = (rowWidth.value - n * AVATAR_PX) / (n - 1);
  return Math.max(-AVATAR_PX / 2, gap);
});
const overlapping = computed(() => stepMargin.value < 0);
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

    <!-- Default: single straight line of GOING/MAYBE avatars filling the card
         width + "+N" chip. Wrappers are `flex` so the inline-grid Avatar has no
         baseline gap (keeps the row straight); marginLeft spaces/overlaps them
         to span the full width. -->
    <div v-else ref="rowEl" class="flex items-center" :class="spread ? '' : 'gap-3'">
      <div
        v-for="(a, i) in shownAttendees"
        :key="a.user.id"
        class="relative flex rounded-full"
        :class="overlapping ? 'ring-2 ring-surface' : ''"
        :style="{ marginLeft: spread && i > 0 ? `${stepMargin}px` : undefined }"
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
      <div
        v-if="overflowCount > 0"
        class="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-fg-2"
        :class="overlapping ? 'ring-2 ring-surface' : ''"
        :style="{ marginLeft: spread && shownAttendees.length > 0 ? `${stepMargin}px` : undefined }"
        :title="`${overflowCount} more`"
      >
        +{{ overflowCount }}
      </div>
    </div>
  </div>
</template>
