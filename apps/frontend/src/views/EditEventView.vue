<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, onBeforeRouteLeave, useRouter } from 'vue-router';
import EventForm from '@/components/EventForm.vue';
import { useEventsStore } from '@/stores/events';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import type { CreateEventInput } from '@/types';

const props = defineProps<{ id: string }>();

const router = useRouter();
const events = useEventsStore();
const identity = useIdentityStore();
const ui = useUiStore();

const loading = ref(true);
const saving = ref(false);
const dirty = ref(false);

// Warn before leaving mid-edit — there's no draft-restore safety net here
// (EventForm never restores a draft once `initial` is set, on purpose, so a
// stale local draft can never clobber another device's more recent edit).
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  return ui.confirm({
    title: 'Discard changes?',
    message: "You've made changes that haven't been saved. Leave without saving?",
    confirmText: 'Discard',
    danger: true,
  });
});

const event = computed(() => events.current);
const isCreator = computed(() => !!event.value && identity.id === event.value.creatorId);

const initial = computed<Partial<CreateEventInput>>(() =>
  event.value
    ? {
        title: event.value.title,
        description: event.value.description ?? undefined,
        date: event.value.date,
        startTime: event.value.startTime ?? undefined,
        endTime: event.value.endTime ?? undefined,
        location: event.value.location ?? undefined,
        latitude: event.value.latitude ?? undefined,
        longitude: event.value.longitude ?? undefined,
        coverImage: event.value.coverImage ?? undefined,
        capacity: event.value.capacity,
        visibility: event.value.visibility,
        attendanceMode: event.value.attendanceMode,
        minPafAmount: event.value.minPafAmount,
        ticketPrice: event.value.ticketPrice,
      }
    : {},
);

onMounted(async () => {
  try {
    await events.fetchEvent(props.id);
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Event not found', 'error');
  } finally {
    loading.value = false;
  }
});

async function onSubmit(value: CreateEventInput): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const updated = await events.update(props.id, value);
    dirty.value = false;
    ui.toast('Saved', 'success');
    await router.push(`/event/${updated.slug}`);
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  } finally {
    saving.value = false;
  }
}

async function onDelete(): Promise<void> {
  const ok = await ui.confirm({
    title: 'Delete event',
    message: 'Delete this event? This cannot be undone.',
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  try {
    await events.remove(props.id);
    dirty.value = false;
    ui.toast('Event deleted', 'success');
    await router.push('/dashboard');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold tracking-tight">Edit event</h1>
      <RouterLink
        :to="event ? `/event/${event.slug}` : '/dashboard'"
        class="text-sm font-semibold text-red-500 hover:text-red-600"
      >
        Cancel
      </RouterLink>
    </div>

    <p v-if="loading" class="text-sm text-fg-2">Loading…</p>

    <template v-else-if="event">
      <p v-if="!isCreator" class="rounded-xl bg-surface-2 px-3 py-2 text-xs text-fg-2">
        Only the creator can save changes.
      </p>

      <EventForm
        :initial="initial"
        submit-label="Save changes"
        :loading="saving"
        @submit="onSubmit"
        @dirty="dirty = $event"
      />

      <button
        v-if="isCreator"
        type="button"
        class="btn w-full bg-red-600/90 text-white hover:bg-red-600"
        @click="onDelete"
      >
        Delete event
      </button>
    </template>

    <p v-else class="text-sm text-fg-2">Event not found.</p>
  </div>
</template>
