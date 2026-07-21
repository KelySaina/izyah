<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import EventCard from '@/components/EventCard.vue';
import EmptyState from '@/components/EmptyState.vue';

const events = useEventsStore();
const ui = useUiStore();
const router = useRouter();

const joinValue = ref('');

/** Accept a full event URL or a bare slug and route to its detail page. */
function join(): void {
  const raw = joinValue.value.trim();
  if (!raw) return;
  const clean = raw.split(/[?#]/)[0] ?? '';
  const segments = clean.split('/').filter(Boolean);
  const slug = segments[segments.length - 1];
  if (!slug) {
    ui.toast('Paste an event link or code', 'error');
    return;
  }
  router.push('/event/' + slug);
}

onMounted(async () => {
  try {
    await events.fetchEvents('upcoming');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
});
</script>

<template>
  <div class="space-y-8">
    <!-- Hero -->
    <section class="pt-4 text-center">
      <div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-3xl">
        🎉
      </div>
      <h1 class="text-3xl font-black tracking-tight">Events, together.</h1>
      <p class="mx-auto mt-2 max-w-xs text-sm text-slate-400">
        Plan, invite, and celebrate — all in one place.
      </p>
      <RouterLink to="/create" class="btn-primary mt-6 w-full">
        <span aria-hidden="true">+</span> Create an event
      </RouterLink>
    </section>

    <!-- Join with a link -->
    <section class="card p-4">
      <label for="join" class="label">Join with a link</label>
      <form class="flex items-center gap-2" @submit.prevent="join">
        <input
          id="join"
          v-model="joinValue"
          class="input"
          type="text"
          placeholder="Paste an event link or code"
          inputmode="url"
          autocomplete="off"
        />
        <button type="submit" class="btn-ghost shrink-0">Join</button>
      </form>
    </section>

    <!-- Upcoming events -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-slate-400">Upcoming</h2>

      <div v-if="events.loading" class="grid place-items-center py-10 text-slate-500">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>

      <div v-else-if="events.events.length" class="space-y-3">
        <EventCard v-for="event in events.events" :key="event.id" :event="event" />
      </div>

      <EmptyState
        v-else
        icon="🗓️"
        title="No upcoming events"
        subtitle="Be the first to plan something."
      >
        <RouterLink to="/create" class="btn-primary">Create an event</RouterLink>
      </EmptyState>
    </section>
  </div>
</template>
