<script setup lang="ts">
import { reactive } from 'vue';
import ImagePicker from '@/components/ImagePicker.vue';
import { useUiStore } from '@/stores/ui';
import type { CreateEventInput } from '@/types';

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

// The <input type="date"> wants YYYY-MM-DD; normalise any ISO initial value.
const form = reactive({
  title: props.initial?.title ?? '',
  description: props.initial?.description ?? '',
  date: (props.initial?.date ?? '').slice(0, 10),
  startTime: props.initial?.startTime ?? '',
  endTime: props.initial?.endTime ?? '',
  location: props.initial?.location ?? '',
  coverImage: props.initial?.coverImage ?? '',
});

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
    coverImage: clean(form.coverImage),
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

    <div>
      <label class="label" for="ev-loc">Location</label>
      <input id="ev-loc" v-model="form.location" class="input" placeholder="Where?" />
    </div>

    <button type="submit" class="btn-primary w-full" :disabled="loading">
      {{ loading ? 'Saving…' : submitLabel }}
    </button>
  </form>
</template>
