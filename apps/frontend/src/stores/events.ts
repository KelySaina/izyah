import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api';
import type {
  AttendeeDTO,
  CreateEventInput,
  EventDTO,
  RsvpCounts,
  RsvpStatus,
  UpdateEventInput,
} from '@/types';

const EMPTY_COUNTS: RsvpCounts = { going: 0, maybe: 0, notGoing: 0, waitlist: 0, total: 0 };

export const useEventsStore = defineStore('events', () => {
  const events = ref<EventDTO[]>([]);
  // Discovery feed (upcoming PUBLIC events you're not in), kept separate so the
  // Home page can show it alongside your "Upcoming" list.
  const publicEvents = ref<EventDTO[]>([]);
  const current = ref<EventDTO | null>(null);
  const attendees = ref<AttendeeDTO[]>([]);
  const counts = ref<RsvpCounts>({ ...EMPTY_COUNTS });
  const loading = ref(false);
  const publicLoading = ref(false);

  async function fetchEvents(scope: 'upcoming' | 'mine' | 'past' = 'upcoming'): Promise<void> {
    loading.value = true;
    try {
      events.value = await api.events.list(scope);
    } finally {
      loading.value = false;
    }
  }

  async function fetchPublicEvents(): Promise<void> {
    publicLoading.value = true;
    try {
      publicEvents.value = await api.events.list('public');
    } finally {
      publicLoading.value = false;
    }
  }

  async function fetchEvent(idOrSlug: string): Promise<EventDTO> {
    loading.value = true;
    try {
      const event = await api.events.get(idOrSlug);
      current.value = event;
      counts.value = event.counts;
      return event;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAttendees(eventId: string): Promise<void> {
    const res = await api.participants.attendees(eventId);
    attendees.value = res.attendees;
    counts.value = res.counts;
  }

  async function create(input: CreateEventInput): Promise<EventDTO> {
    const event = await api.events.create(input);
    events.value = [event, ...events.value];
    return event;
  }

  async function update(id: string, input: UpdateEventInput): Promise<EventDTO> {
    const event = await api.events.update(id, input);
    if (current.value?.id === id) current.value = event;
    events.value = events.value.map((e) => (e.id === id ? event : e));
    return event;
  }

  async function remove(id: string): Promise<void> {
    await api.events.remove(id);
    events.value = events.value.filter((e) => e.id !== id);
    if (current.value?.id === id) current.value = null;
  }

  async function setRsvp(eventId: string, status: RsvpStatus): Promise<RsvpStatus> {
    const res = await api.participants.rsvp(eventId, status);
    counts.value = res.counts;
    if (current.value?.id === eventId) {
      current.value = { ...current.value, viewerStatus: res.status, counts: res.counts };
    }
    return res.status;
  }

  /** Live updates pushed over the socket. */
  function applyCounts(next: RsvpCounts): void {
    counts.value = next;
    if (current.value) current.value = { ...current.value, counts: next };
  }
  function applyOnline(n: number): void {
    if (current.value) current.value = { ...current.value, onlineCount: n };
  }

  return {
    events,
    publicEvents,
    current,
    attendees,
    counts,
    loading,
    publicLoading,
    fetchEvents,
    fetchPublicEvents,
    fetchEvent,
    fetchAttendees,
    create,
    update,
    remove,
    setRsvp,
    applyCounts,
    applyOnline,
  };
});
