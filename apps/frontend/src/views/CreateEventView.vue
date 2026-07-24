<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import EventForm from '@/components/EventForm.vue';
import { useEventsStore } from '@/stores/events';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import type { CreateEventInput } from '@/types';

const router = useRouter();
const events = useEventsStore();
const ui = useUiStore();
const saving = ref(false);

// Autosaved by EventForm while filling this out, so a refresh or an
// accidental nav-away doesn't lose the draft. Cleared only once the event is
// actually created — not just submitted, in case the request fails.
const DRAFT_KEY = 'izyah:create-event-draft';

async function onSubmit(value: CreateEventInput): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const created = await events.create(value);
    localStorage.removeItem(DRAFT_KEY);
    ui.toast('Event created', 'success');
    await router.push(`/event/${created.slug}`);
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold tracking-tight">Create event</h1>
      <!-- Leaves without touching the saved draft — same as tapping the
           bottom nav mid-fill, just a clearer way to back out. -->
      <RouterLink to="/" class="text-sm font-semibold text-red-500 hover:text-red-600">Cancel</RouterLink>
    </div>
    <EventForm submit-label="Create" :loading="saving" :draft-key="DRAFT_KEY" @submit="onSubmit" />
  </div>
</template>
