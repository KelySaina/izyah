<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import EventForm from '@/components/EventForm.vue';
import { useEventsStore } from '@/stores/events';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import type { CreateEventInput } from '@/types';

const router = useRouter();
const events = useEventsStore();
const ui = useUiStore();
const saving = ref(false);

async function onSubmit(value: CreateEventInput): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const created = await events.create(value);
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
    <h1 class="text-xl font-bold tracking-tight">Create event</h1>
    <EventForm submit-label="Create" :loading="saving" @submit="onSubmit" />
  </div>
</template>
