<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import EventCard from '@/components/EventCard.vue';
import EmptyState from '@/components/EmptyState.vue';

type Scope = 'upcoming' | 'mine' | 'past';

const events = useEventsStore();
const ui = useUiStore();

const tabs: { scope: Scope; label: string }[] = [
  { scope: 'upcoming', label: 'Upcoming' },
  { scope: 'mine', label: 'All' },
  { scope: 'past', label: 'Past' },
];

const active = ref<Scope>('upcoming');

async function load(scope: Scope): Promise<void> {
  try {
    await events.fetchEvents(scope);
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}

function select(scope: Scope): void {
  if (scope === active.value) return;
  active.value = scope;
  load(scope);
}

onMounted(() => load(active.value));
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-black tracking-tight">Your events</h1>

    <!-- Scope tabs -->
    <div class="flex gap-1 rounded-xl bg-ink-800 p-1">
      <button
        v-for="tab in tabs"
        :key="tab.scope"
        type="button"
        class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition"
        :class="
          active === tab.scope ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
        "
        :aria-pressed="active === tab.scope"
        @click="select(tab.scope)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- List -->
    <div v-if="events.loading" class="grid place-items-center py-12 text-slate-500">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
    </div>

    <div v-else-if="events.events.length" class="space-y-3">
      <EventCard v-for="event in events.events" :key="event.id" :event="event" />
    </div>

    <EmptyState
      v-else
      icon="🗓️"
      title="Nothing here yet"
      subtitle="Events you create or join will show up here."
    >
      <RouterLink to="/create" class="btn-primary">Create an event</RouterLink>
    </EmptyState>
  </div>
</template>
