<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Globe, Lock, Ban, Coins, Ticket } from 'lucide-vue-next';
import ImagePicker from '@/components/ImagePicker.vue';
import LocationPicker from '@/components/LocationPicker.vue';
import { useUiStore } from '@/stores/ui';
import { formatDate, formatTimeRange } from '@/lib/format';
import type { AttendanceMode, CreateEventInput, EventVisibility } from '@/types';

const props = withDefaults(
  defineProps<{
    initial?: Partial<CreateEventInput>;
    submitLabel?: string;
    loading?: boolean;
    /** When set, the form autosaves to localStorage under this key and
     *  restores from it on mount — only for a fresh create (never when
     *  `initial` is set, so editing an existing event always shows the
     *  server's data, not a stray local draft). The caller is responsible
     *  for clearing the key once a submit actually succeeds. */
    draftKey?: string;
  }>(),
  { initial: undefined, submitLabel: 'Save', loading: false, draftKey: undefined },
);

interface FormDraft {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  capacity: string;
  visibility: 'PUBLIC' | 'PRIVATE' | null;
  attendanceMode: AttendanceMode;
  minPafAmount: string;
  ticketPrice: string;
}

function readDraft(): Partial<FormDraft> | null {
  if (!props.draftKey || props.initial) return null;
  try {
    const raw = localStorage.getItem(props.draftKey);
    return raw ? (JSON.parse(raw) as Partial<FormDraft>) : null;
  } catch {
    return null;
  }
}

const draft = readDraft();

const emit = defineEmits<{
  (e: 'submit', value: CreateEventInput): void;
  /** Fires whenever the form's fields differ from where they started, so a
   *  caller (EditEventView) can warn before navigating away mid-edit. */
  (e: 'dirty', value: boolean): void;
}>();

const ui = useUiStore();

// Two-type model in the UI: Public (discoverable on Home) vs Private (link-only).
// Any non-PUBLIC stored value collapses to "Private" for the toggle. An event
// being EDITED already has a decided visibility; a brand-new one starts unset
// so publishing publicly (or privately) is always a conscious choice, never a
// silent default.
const initialVisibility: 'PUBLIC' | 'PRIVATE' | null = props.initial?.visibility
  ? props.initial.visibility !== 'PUBLIC'
    ? 'PRIVATE'
    : 'PUBLIC'
  : null;

const visibilityOptions: {
  value: 'PUBLIC' | 'PRIVATE';
  label: string;
  hint: string;
  icon: typeof Globe;
}[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Listed on Home for anyone to discover', icon: Globe },
  { value: 'PRIVATE', label: 'Private', hint: 'Hidden — only people with the link can join', icon: Lock },
];

const attendanceModeOptions: {
  value: AttendanceMode;
  label: string;
  hint: string;
  icon: typeof Ban;
}[] = [
  { value: 'NONE', label: 'None', hint: 'Anyone who RSVPs is good to go', icon: Ban },
  { value: 'MIN_PAF', label: 'Min PAF', hint: 'In-person contribution, you mark who paid', icon: Coins },
  { value: 'TICKET', label: 'Ticket', hint: 'Fixed price, attendees get a QR you scan', icon: Ticket },
];

// The <input type="date"> wants YYYY-MM-DD; normalise any ISO initial value.
// A restored draft wins over `initial` defaults — `readDraft()` only ever
// returns non-null when there's no `initial` to begin with (see above).
const form = reactive<FormDraft>({
  title: draft?.title ?? props.initial?.title ?? '',
  description: draft?.description ?? props.initial?.description ?? '',
  date: draft?.date ?? (props.initial?.date ?? '').slice(0, 10),
  startTime: draft?.startTime ?? props.initial?.startTime ?? '',
  endTime: draft?.endTime ?? props.initial?.endTime ?? '',
  location: draft?.location ?? props.initial?.location ?? '',
  latitude: draft?.latitude ?? props.initial?.latitude ?? null,
  longitude: draft?.longitude ?? props.initial?.longitude ?? null,
  coverImage: draft?.coverImage ?? props.initial?.coverImage ?? '',
  capacity: draft?.capacity ?? (props.initial?.capacity != null ? String(props.initial.capacity) : ''),
  visibility: draft?.visibility ?? initialVisibility,
  attendanceMode: draft?.attendanceMode ?? props.initial?.attendanceMode ?? 'NONE',
  minPafAmount:
    draft?.minPafAmount ?? (props.initial?.minPafAmount != null ? String(props.initial.minPafAmount) : ''),
  ticketPrice:
    draft?.ticketPrice ?? (props.initial?.ticketPrice != null ? String(props.initial.ticketPrice) : ''),
});

if (props.draftKey) {
  watch(
    form,
    (value) => {
      try {
        localStorage.setItem(props.draftKey!, JSON.stringify(value));
      } catch {
        // Storage full/unavailable (e.g. private browsing) — draft just
        // won't persist this session; the form itself still works fine.
      }
    },
    { deep: true },
  );
}

// Baseline snapshot (post draft-restore) so callers can be warned before
// navigating away with unsaved changes — most useful on Edit, where there's
// no draft-restore safety net (see readDraft() above).
const initialSnapshot = JSON.stringify(form);
watch(
  form,
  (value) => emit('dirty', JSON.stringify(value) !== initialSnapshot),
  { deep: true },
);

type Tab = 'basics' | 'when' | 'where' | 'options';
const tabs: { key: Tab; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'when', label: 'When' },
  { key: 'where', label: 'Where' },
  { key: 'options', label: 'Options' },
];
const activeTab = ref<Tab>('basics');

// Drives the little "still needs something" marker on each tab and in the
// overview card above them — live, not just on submit, so incompleteness is
// visible before you ever try to save.
const missing = computed(() => ({
  basics: !form.title.trim(),
  when: !form.date,
  where: !form.location.trim(),
  options:
    !form.visibility ||
    (form.attendanceMode === 'MIN_PAF' && !form.minPafAmount.trim()) ||
    (form.attendanceMode === 'TICKET' && !form.ticketPrice.trim()),
}));
const anyMissing = computed(() => Object.values(missing.value).some(Boolean));

// Themed (brand gold, not a generic red) outline for a required field that's
// still empty — so it's visible at a glance the moment its tab opens, not
// only via the tab-badge dot.
const NEEDS_ATTENTION = 'border-brand-500/50 ring-2 ring-brand-500/20';

const titleInput = ref<HTMLInputElement | null>(null);
// Land the cursor straight in the first empty required field on open — for a
// fresh create that's always the title, since Basics is the default tab.
onMounted(() => {
  if (!form.title.trim()) titleInput.value?.focus();
});

// Only steer NEW events away from a past date — an existing (possibly past,
// e.g. a recap) event being edited for other reasons shouldn't get flagged
// invalid just for showing the date it already has.
const todayStr = new Date().toISOString().slice(0, 10);
const minDate = computed(() => (props.initial ? undefined : todayStr));

const visibilityLabel = computed(
  () => visibilityOptions.find((o) => o.value === form.visibility)?.label ?? 'Not chosen',
);

function onLocationUpdate(v: {
  location: string;
  latitude: number | null;
  longitude: number | null;
}): void {
  form.location = v.location;
  form.latitude = v.latitude;
  form.longitude = v.longitude;
}

function clean(value: string): string | undefined {
  const v = value.trim();
  return v.length ? v : undefined;
}

function isPositiveInt(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) >= 1;
}

function onSubmit(): void {
  if (missing.value.basics) {
    activeTab.value = 'basics';
    ui.toast('A title is required', 'error');
    return;
  }
  if (missing.value.when) {
    activeTab.value = 'when';
    ui.toast('A date is required', 'error');
    return;
  }
  if (missing.value.where) {
    activeTab.value = 'where';
    ui.toast('A location is required', 'error');
    return;
  }
  if (form.startTime && form.endTime && form.endTime <= form.startTime) {
    activeTab.value = 'when';
    ui.toast('End time must be after the start time', 'error');
    return;
  }
  if (missing.value.options) {
    activeTab.value = 'options';
    ui.toast('Choose who can see this event', 'error');
    return;
  }
  const capacityTrimmed = form.capacity.trim();
  if (capacityTrimmed && !isPositiveInt(capacityTrimmed)) {
    activeTab.value = 'options';
    ui.toast('Capacity must be a positive number', 'error');
    return;
  }
  const minPafTrimmed = form.minPafAmount.trim();
  if (form.attendanceMode === 'MIN_PAF' && !isPositiveInt(minPafTrimmed)) {
    activeTab.value = 'options';
    ui.toast('Minimum contribution must be a positive number', 'error');
    return;
  }
  const ticketPriceTrimmed = form.ticketPrice.trim();
  if (form.attendanceMode === 'TICKET' && !isPositiveInt(ticketPriceTrimmed)) {
    activeTab.value = 'options';
    ui.toast('Ticket price must be a positive number', 'error');
    return;
  }
  emit('submit', {
    title: form.title.trim(),
    description: clean(form.description),
    date: form.date,
    startTime: clean(form.startTime),
    endTime: clean(form.endTime),
    location: clean(form.location),
    latitude: form.latitude ?? undefined,
    longitude: form.longitude ?? undefined,
    coverImage: clean(form.coverImage),
    capacity: capacityTrimmed ? Number(capacityTrimmed) : null,
    visibility: form.visibility as EventVisibility,
    attendanceMode: form.attendanceMode,
    minPafAmount: form.attendanceMode === 'MIN_PAF' ? Number(minPafTrimmed) : null,
    ticketPrice: form.attendanceMode === 'TICKET' ? Number(ticketPriceTrimmed) : null,
  });
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- Overview — always visible, this is where Create/Save lives -->
    <div class="card space-y-3 p-4">
      <img
        v-if="form.coverImage"
        :src="form.coverImage"
        alt=""
        class="h-32 w-full rounded-lg object-cover"
      />
      <button
        type="button"
        class="block text-left"
        :class="form.title ? '' : 'flex items-center gap-1.5'"
        @click="activeTab = 'basics'"
      >
        <span class="text-lg font-bold" :class="form.title ? 'text-fg' : 'text-accent underline'">
          {{ form.title || 'Untitled — tap to add a title' }}
        </span>
        <span v-if="!form.title" class="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[10px] font-black leading-none text-ink-900">!</span>
      </button>
      <p v-if="form.description" class="whitespace-pre-wrap text-sm text-fg-2">{{ form.description }}</p>

      <dl class="space-y-2 text-sm">
        <div class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">Date</dt>
          <dd>
            <span v-if="form.date" class="text-fg">{{ formatDate(form.date) }}</span>
            <button
              v-else
              type="button"
              class="flex items-center gap-1.5 font-semibold text-accent underline"
              @click="activeTab = 'when'"
            >
              Not set
              <span class="grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-[10px] font-black leading-none text-ink-900">!</span>
            </button>
          </dd>
        </div>
        <div v-if="form.startTime" class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">Time</dt>
          <dd class="text-fg">{{ formatTimeRange(form.startTime, form.endTime) }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">Location</dt>
          <dd>
            <span v-if="form.location" class="truncate text-fg">{{ form.location }}</span>
            <button
              v-else
              type="button"
              class="flex items-center gap-1.5 font-semibold text-accent underline"
              @click="activeTab = 'where'"
            >
              Not set
              <span class="grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-[10px] font-black leading-none text-ink-900">!</span>
            </button>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">Capacity</dt>
          <dd class="text-fg">{{ form.capacity || 'Unlimited' }}</dd>
        </div>
        <div v-if="form.attendanceMode !== 'NONE'" class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">{{ form.attendanceMode === 'TICKET' ? 'Ticket price' : 'Min PAF' }}</dt>
          <dd class="text-fg">
            {{ (form.attendanceMode === 'TICKET' ? form.ticketPrice : form.minPafAmount) || '—' }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-fg-3">Visibility</dt>
          <dd>
            <span v-if="form.visibility" class="text-fg">{{ visibilityLabel }}</span>
            <button
              v-else
              type="button"
              class="flex items-center gap-1.5 font-semibold text-accent underline"
              @click="activeTab = 'options'"
            >
              Not set
              <span class="grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-[10px] font-black leading-none text-ink-900">!</span>
            </button>
          </dd>
        </div>
      </dl>

      <button v-if="!anyMissing" type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Saving…' : submitLabel }}
      </button>
      <p v-else class="flex items-center justify-center gap-1.5 text-center text-xs text-fg-3">
        <span class="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[10px] font-black leading-none text-ink-900">!</span>
        Fill in the marked fields below to continue.
      </p>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-1 rounded-xl bg-surface p-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-xs font-semibold transition"
        :class="activeTab === tab.key ? 'bg-brand-500 text-ink-900' : 'text-fg-2 hover:text-fg'"
        :aria-pressed="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span
          v-if="missing[tab.key]"
          class="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] font-black leading-none"
          :class="activeTab === tab.key ? 'bg-ink-900 text-brand-500' : 'bg-brand-500 text-ink-900'"
          aria-hidden="true"
        >
          !
        </span>
      </button>
    </div>

    <!-- The basics -->
    <div v-show="activeTab === 'basics'" class="space-y-4">
      <ImagePicker v-model="form.coverImage" kind="cover" label="Cover photo" />

      <div>
        <label class="label" for="ev-title">Title *</label>
        <input
          id="ev-title"
          ref="titleInput"
          v-model="form.title"
          class="input"
          :class="!form.title.trim() ? NEEDS_ATTENTION : ''"
          placeholder="Rooftop dinner party"
        />
      </div>

      <div>
        <label class="label" for="ev-desc">Description</label>
        <textarea
          id="ev-desc"
          v-model="form.description"
          rows="3"
          class="input resize-none"
          placeholder="What's the plan?"
        />
      </div>
    </div>

    <!-- When -->
    <div v-show="activeTab === 'when'" class="space-y-4">
      <div>
        <label class="label" for="ev-date">Date *</label>
        <input
          id="ev-date"
          v-model="form.date"
          type="date"
          class="input"
          :min="minDate"
          :class="!form.date ? NEEDS_ATTENTION : ''"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="ev-start">Start</label>
          <input id="ev-start" v-model="form.startTime" type="time" class="input" />
        </div>
        <div>
          <label class="label" for="ev-end">End</label>
          <input id="ev-end" v-model="form.endTime" type="time" class="input" />
        </div>
      </div>
    </div>

    <!-- Where -->
    <div v-show="activeTab === 'where'" class="space-y-4">
      <LocationPicker
        :location="form.location"
        :latitude="form.latitude"
        :longitude="form.longitude"
        @update="onLocationUpdate"
      />
    </div>

    <!-- Options -->
    <div v-show="activeTab === 'options'" class="space-y-4">
      <div>
        <label class="label" for="ev-capacity">Capacity</label>
        <input
          id="ev-capacity"
          v-model="form.capacity"
          type="text"
          inputmode="numeric"
          class="input"
          placeholder="Unlimited"
        />
        <p class="mt-1 text-xs text-fg-3">
          Leave blank for no limit. Once full, new RSVPs join a waitlist.
        </p>
      </div>

      <div>
        <span class="label">Attendance</span>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="opt in attendanceModeOptions"
            :key="opt.value"
            type="button"
            class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition"
            :class="
              form.attendanceMode === opt.value
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-line/15 bg-surface-2 hover:border-line/30'
            "
            :aria-pressed="form.attendanceMode === opt.value"
            @click="form.attendanceMode = opt.value"
          >
            <span class="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <component :is="opt.icon" :size="15" :stroke-width="2.25" /> {{ opt.label }}
            </span>
            <span class="text-xs leading-snug text-fg-3">{{ opt.hint }}</span>
          </button>
        </div>

        <div v-if="form.attendanceMode === 'MIN_PAF'" class="mt-3">
          <label class="label" for="ev-min-paf">Minimum contribution *</label>
          <input
            id="ev-min-paf"
            v-model="form.minPafAmount"
            type="text"
            inputmode="numeric"
            class="input"
            :class="!form.minPafAmount.trim() ? NEEDS_ATTENTION : ''"
            placeholder="e.g. 20000"
          />
        </div>
        <div v-if="form.attendanceMode === 'TICKET'" class="mt-3">
          <label class="label" for="ev-ticket-price">Ticket price *</label>
          <input
            id="ev-ticket-price"
            v-model="form.ticketPrice"
            type="text"
            inputmode="numeric"
            class="input"
            :class="!form.ticketPrice.trim() ? NEEDS_ATTENTION : ''"
            placeholder="e.g. 20000"
          />
        </div>
        <p
          v-if="
            initial?.attendanceMode &&
            initial.attendanceMode !== 'NONE' &&
            form.attendanceMode !== initial.attendanceMode
          "
          class="mt-2 text-xs text-fg-3"
        >
          Changing this won't affect already-collected payments or check-ins — it only changes
          what's tracked going forward.
        </p>
      </div>

      <div>
        <span class="label">Visibility *</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in visibilityOptions"
            :key="opt.value"
            type="button"
            class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition"
            :class="
              form.visibility === opt.value
                ? 'border-brand-500 bg-brand-500/10'
                : !form.visibility
                  ? NEEDS_ATTENTION + ' bg-surface-2'
                  : 'border-line/15 bg-surface-2 hover:border-line/30'
            "
            :aria-pressed="form.visibility === opt.value"
            @click="form.visibility = opt.value"
          >
            <span class="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <component :is="opt.icon" :size="15" :stroke-width="2.25" /> {{ opt.label }}
            </span>
            <span class="text-xs leading-snug text-fg-3">{{ opt.hint }}</span>
          </button>
        </div>
      </div>
    </div>
  </form>
</template>
