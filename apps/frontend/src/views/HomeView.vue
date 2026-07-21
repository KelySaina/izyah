<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Plus, ArrowRight, CalendarPlus } from 'lucide-vue-next';
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
    <section class="relative pt-2 text-center">
      <div
        class="pointer-events-none absolute inset-x-0 -top-8 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(247,195,49,0.18),transparent_65%)]"
        aria-hidden="true"
      />
      <img
        src="/icons/logo_app.png"
        alt="Izy'Ah"
        class="relative mx-auto w-36 animate-pop-in drop-shadow-[0_10px_30px_rgba(247,195,49,0.25)]"
      />
      <h1 class="relative mt-3 font-display text-3xl font-bold tracking-tight">Events, together.</h1>
      <p class="relative mx-auto mt-2 max-w-xs text-sm text-fg-2">
        Plan, invite, and celebrate — all in one place.
      </p>
      <RouterLink to="/create" class="btn-primary relative mt-6 w-full">
        <Plus :size="18" :stroke-width="2.5" /> Create an event
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
        <button type="submit" class="btn-ghost shrink-0 !px-3.5" aria-label="Join event">
          <ArrowRight :size="18" />
        </button>
      </form>
    </section>

    <!-- Upcoming events -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-fg-3">Upcoming</h2>

      <div v-if="events.loading" class="grid place-items-center py-10">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-line/20 border-t-brand-500" />
      </div>

      <div v-else-if="events.events.length" class="space-y-3">
        <EventCard v-for="event in events.events" :key="event.id" :event="event" />
      </div>

      <EmptyState
        v-else
        :icon="CalendarPlus"
        title="No upcoming events"
        subtitle="Be the first to plan something."
      >
        <RouterLink to="/create" class="btn-primary">Create an event</RouterLink>
      </EmptyState>
    </section>
  </div>
</template>
