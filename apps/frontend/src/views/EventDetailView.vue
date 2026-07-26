<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Clock,
  MapPin,
  Pencil,
  Compass,
  Image as ImageIcon,
  PartyPopper,
  MessageCircle,
  ListChecks,
  BarChart3,
  ChevronRight,
  QrCode,
} from 'lucide-vue-next';
import Avatar from '@/components/Avatar.vue';
import DateBadge from '@/components/DateBadge.vue';
import EmptyState from '@/components/EmptyState.vue';
import RsvpButtons from '@/components/RsvpButtons.vue';
import AttendeeList from '@/components/AttendeeList.vue';
import MyTicketCard from '@/components/MyTicketCard.vue';
import TicketScanner from '@/components/TicketScanner.vue';
import ShareSheet from '@/components/ShareSheet.vue';
import MediaGallery from '@/components/MediaGallery.vue';
import EventDetailSkeleton from '@/components/EventDetailSkeleton.vue';
import Lightbox from '@/components/Lightbox.vue';
import EventMap from '@/components/EventMap.vue';
import { useEventsStore } from '@/stores/events';
import { useIdentityStore } from '@/stores/identity';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';
import { api, ApiError } from '@/services/api';
import { formatDate, formatTimeRange } from '@/lib/format';
import type { RsvpStatus } from '@/types';

const props = defineProps<{ idOrSlug: string }>();

const events = useEventsStore();
const identity = useIdentityStore();
const chat = useChatStore();
const ui = useUiStore();

const loading = ref(true);
const notFound = ref(false);
const coverLightbox = ref<number | null>(null);
const scannerOpen = ref(false);
// Best-effort counts for the Chat/Tasks/Polls entry point below — fetched
// alongside the page, never blocking it, since they're a secondary signal.
const taskCount = ref(0);
const pollCount = ref(0);

// Chat (and its presence/unread tracking) stays joined for as long as this
// event's page is open — the Chat/Tasks/Polls sheet itself lives in App.vue,
// opened from the header icon.
onBeforeUnmount(() => chat.close());

const event = computed(() => events.current);
const isCreator = computed(() => !!event.value && identity.id === event.value.creatorId);
// Day-granular: an event "happened" once its date has passed, regardless of
// its start/end time. Matches the backend's own upcoming/past bucketing.
const isPast = computed(() => !!event.value && new Date(event.value.date) < new Date());

async function loadCounts(eventId: string): Promise<void> {
  try {
    const [tasks, polls] = await Promise.all([api.tasks.list(eventId), api.polls.list(eventId)]);
    taskCount.value = tasks.length;
    pollCount.value = polls.length;
  } catch {
    // Non-critical — the entry point just shows without task/poll counts.
  }
}

async function load(idOrSlug: string): Promise<void> {
  loading.value = true;
  notFound.value = false;
  taskCount.value = 0;
  pollCount.value = 0;
  try {
    const e = await events.fetchEvent(idOrSlug);
    void loadCounts(e.id);
    await events.fetchAttendees(e.id);
    await chat.open(e.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound.value = true;
    else ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(props.idOrSlug));
// Support navigating between events without unmounting the view.
watch(
  () => props.idOrSlug,
  (next) => load(next),
);

async function onRsvp(status: RsvpStatus): Promise<void> {
  if (!event.value) return;
  try {
    const effective = await events.setRsvp(event.value.id, status);
    ui.toast(
      effective === 'WAITLIST' ? "You're on the waitlist" : "You're on the list",
      'success',
    );
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}

async function onToggleAttendee(
  userId: string,
  patch: { paid?: boolean; checkedIn?: boolean },
): Promise<void> {
  if (!event.value) return;
  try {
    await events.updateAttendee(event.value.id, userId, patch);
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}
</script>

<template>
  <EventDetailSkeleton v-if="loading" />

  <EmptyState
    v-else-if="notFound || !event"
    :icon="Compass"
    title="Event not found"
    subtitle="This link may be wrong or the event was removed."
  >
    <RouterLink to="/" class="btn-primary">Back home</RouterLink>
  </EmptyState>

  <div v-else class="space-y-6">
    <!-- Cover (tap to enlarge) -->
    <button
      v-if="event.coverImage"
      type="button"
      class="-mx-4 -mt-4 block w-[calc(100%+2rem)] cursor-zoom-in"
      aria-label="View cover photo"
      @click="coverLightbox = 0"
    >
      <img :src="event.coverImage" :alt="event.title" class="h-48 w-full object-cover" />
    </button>

    <!-- Header -->
    <header class="space-y-3">
      <div class="flex items-start gap-3">
        <DateBadge :date="event.date" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h1 class="font-display text-2xl font-bold leading-tight tracking-tight">
              {{ event.title }}
            </h1>
            <span
              v-if="isPast"
              class="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-2"
            >
              <PartyPopper :size="11" /> Recap
            </span>
          </div>
          <p class="mt-1 text-sm text-fg-2">{{ formatDate(event.date) }}</p>
          <p v-if="event.startTime" class="mt-0.5 flex items-center gap-1.5 text-sm text-fg-2">
            <Clock :size="14" class="text-fg-3" />
            {{ formatTimeRange(event.startTime, event.endTime) }}
          </p>
          <p v-if="event.location" class="mt-0.5 flex items-center gap-1.5 text-sm text-fg-2">
            <MapPin :size="14" class="text-fg-3" /> {{ event.location }}
          </p>
        </div>
        <div v-if="isCreator" class="flex shrink-0 flex-col gap-1.5">
          <button
            v-if="event.attendanceMode === 'TICKET' && !isPast"
            type="button"
            class="btn-ghost !gap-1.5 !px-3 !py-1.5 text-xs"
            @click="scannerOpen = true"
          >
            <QrCode :size="14" /> Scan tickets
          </button>
          <RouterLink
            :to="`/event/${event.id}/edit`"
            class="btn-ghost !gap-1.5 !px-3 !py-1.5 text-xs"
          >
            <Pencil :size="14" /> Edit
          </RouterLink>
        </div>
      </div>

      <div v-if="event.creator" class="flex items-center gap-2 text-sm text-fg-2">
        <Avatar :user="event.creator" :size="24" />
        <span>Hosted by <span class="font-medium text-fg-2">{{ event.creator.displayName }}</span></span>
      </div>

      <p v-if="event.description" class="whitespace-pre-wrap text-sm leading-relaxed text-fg-2">
        {{ event.description }}
      </p>
    </header>

    <!-- Location map (only when the event has a pinned position) -->
    <EventMap
      v-if="event.latitude != null && event.longitude != null"
      :key="`map-${event.id}`"
      :lat="event.latitude"
      :lng="event.longitude"
      :label="event.location ?? undefined"
    />

    <!-- RSVP (live) vs. recap summary (past) -->
    <p v-if="isPast" class="text-center text-sm text-fg-2">
      {{ event.counts.going }} {{ event.counts.going === 1 ? 'person' : 'people' }} went to this one 🎉
    </p>
    <RsvpButtons
      v-else
      :status="event.viewerStatus"
      :counts="event.counts"
      :capacity="event.capacity"
      @change="onRsvp"
    />

    <!-- Your ticket QR (TICKET events, once you're GOING — never for the
         host, who's running the door rather than paying to get in) -->
    <MyTicketCard
      v-if="event.attendanceMode === 'TICKET' && event.viewerStatus === 'GOING' && !isPast && !isCreator"
      :event-id="event.id"
    />

    <!-- Chat / tasks / polls entry point -->
    <button
      type="button"
      class="card flex w-full items-center justify-between gap-3 p-4 text-left transition active:scale-[0.99] hover:bg-surface-2"
      @click="chat.sheetOpen = true"
    >
      <div class="flex items-center gap-4 text-sm text-fg-2">
        <span class="flex items-center gap-1.5">
          <MessageCircle :size="15" class="text-accent" /> {{ chat.messages.length }}
        </span>
        <span class="flex items-center gap-1.5">
          <ListChecks :size="15" class="text-accent" /> {{ taskCount }}
        </span>
        <span class="flex items-center gap-1.5">
          <BarChart3 :size="15" class="text-accent" /> {{ pollCount }}
        </span>
      </div>
      <span class="flex items-center gap-1 text-xs font-semibold text-fg-3">
        Chat, tasks & polls
        <span
          v-if="chat.unread > 0"
          class="grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-ink-900"
        >
          {{ chat.unread > 9 ? '9+' : chat.unread }}
        </span>
        <ChevronRight :size="14" />
      </span>
    </button>

    <!-- Attendees -->
    <section class="card space-y-3 p-4">
      <h2 class="text-sm font-bold text-fg">Who's coming</h2>
      <AttendeeList
        :attendees="events.attendees"
        :counts="events.counts"
        :online="event.onlineCount"
        :is-host="isCreator"
        :attendance-mode="event.attendanceMode"
        @toggle="onToggleAttendee"
      />
    </section>

    <!-- Share / calendar -->
    <ShareSheet :event="event" />

    <!-- Media -->
    <section class="card space-y-3 p-4" :class="isPast ? 'ring-1 ring-brand-500/30' : ''">
      <h2 class="flex items-center gap-1.5 text-sm font-bold text-fg">
        <ImageIcon :size="15" class="text-accent" /> {{ isPast ? 'Recap photos & videos' : 'Media' }}
      </h2>
      <MediaGallery :key="`media-${event.id}`" :event-id="event.id" />
    </section>

    <Lightbox
      v-model="coverLightbox"
      :items="event.coverImage ? [{ url: event.coverImage, type: 'IMAGE' }] : []"
    />

    <TicketScanner v-if="isCreator" v-model="scannerOpen" :event-id="event.id" />
  </div>
</template>
