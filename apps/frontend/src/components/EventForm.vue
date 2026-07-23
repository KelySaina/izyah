<script setup lang="ts">
import { reactive } from 'vue';
import { Globe, Lock } from 'lucide-vue-next';
import ImagePicker from '@/components/ImagePicker.vue';
import LocationPicker from '@/components/LocationPicker.vue';
import { useUiStore } from '@/stores/ui';
import type { CreateEventInput, EventVisibility } from '@/types';

const props = withDefaults(
  defineProps<{
    initial?: Partial<CreateEventInput>;
    submitLabel?: string;
    loading?: boolean;
  }>(),
  { initial: undefined, submitLabel: 'Save', loading: false },
);

const emit = defineEmits<{ (e: 'submit', value: CreateEventInput): void }>();

const ui = useUiStore();

// Two-type model in the UI: Public (discoverable on Home) vs Private (link-only).
// Any non-PUBLIC stored value collapses to "Private" for the toggle.
const initialVisibility: 'PUBLIC' | 'PRIVATE' =
  props.initial?.visibility && props.initial.visibility !== 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';

const visibilityOptions: {
  value: 'PUBLIC' | 'PRIVATE';
  label: string;
  hint: string;
  icon: typeof Globe;
}[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Listed on Home for anyone to discover', icon: Globe },
  { value: 'PRIVATE', label: 'Private', hint: 'Hidden — only people with the link can join', icon: Lock },
];

// The <input type="date"> wants YYYY-MM-DD; normalise any ISO initial value.
const form = reactive({
  title: props.initial?.title ?? '',
  description: props.initial?.description ?? '',
  date: (props.initial?.date ?? '').slice(0, 10),
  startTime: props.initial?.startTime ?? '',
  endTime: props.initial?.endTime ?? '',
  location: props.initial?.location ?? '',
  latitude: props.initial?.latitude ?? null,
  longitude: props.initial?.longitude ?? null,
  coverImage: props.initial?.coverImage ?? '',
  visibility: initialVisibility as EventVisibility,
});

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

function onSubmit(): void {
  if (!form.title.trim() || !form.date) {
    ui.toast('A title and a date are required', 'error');
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
    visibility: form.visibility,
  });
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <ImagePicker v-model="form.coverImage" kind="cover" label="Cover photo" />

    <div>
      <label class="label" for="ev-title">Title *</label>
      <input id="ev-title" v-model="form.title" class="input" placeholder="Rooftop dinner party" />
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

    <div>
      <label class="label" for="ev-date">Date *</label>
      <input id="ev-date" v-model="form.date" type="date" class="input" />
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

    <LocationPicker
      :location="form.location"
      :latitude="form.latitude"
      :longitude="form.longitude"
      @update="onLocationUpdate"
    />

    <div>
      <span class="label">Visibility</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in visibilityOptions"
          :key="opt.value"
          type="button"
          class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition"
          :class="
            form.visibility === opt.value
              ? 'border-brand-500 bg-brand-500/10'
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

    <button type="submit" class="btn-primary w-full" :disabled="loading">
      {{ loading ? 'Saving…' : submitLabel }}
    </button>
  </form>
</template>
