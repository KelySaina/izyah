import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api';
import type {
  AttendeeDTO,
  CheckinResultDTO,
  CreateEventInput,
  EventDTO,
  MyTicketDTO,
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
    // Deliberately doesn't touch the shared `loading` flag — that's read by
    // Home/Dashboard's list skeleton (via fetchEvents below), and callers of
    // this function (EventDetailView) track their own local loading state.
    // Sharing one flag across both caused a real bug: a slow, stale
    // fetchEvent() call left over from a page the user already navigated
    // away from could flip `loading` on/off later and make an unrelated
    // page's skeleton flicker back in after it had already stabilized.
    const event = await api.events.get(idOrSlug);
    current.value = event;
    counts.value = event.counts;
    return event;
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

  async function fetchMyTicket(eventId: string): Promise<MyTicketDTO | null> {
    const res = await api.participants.myTicket(eventId);
    return res.ticket;
  }

  function patchAttendeeLocal(userId: string, patch: Partial<AttendeeDTO>): void {
    attendees.value = attendees.value.map((a) => (a.user.id === userId ? { ...a, ...patch } : a));
  }

  async function updateAttendee(
    eventId: string,
    userId: string,
    patch: { paid?: boolean; checkedIn?: boolean },
  ): Promise<AttendeeDTO> {
    const attendee = await api.participants.updateAttendee(eventId, userId, patch);
    patchAttendeeLocal(userId, attendee);
    return attendee;
  }

  async function checkin(eventId: string, ticketCode: string): Promise<CheckinResultDTO> {
    const result = await api.participants.checkin(eventId, ticketCode);
    patchAttendeeLocal(result.attendee.user.id, result.attendee);
    return result;
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
    fetchMyTicket,
    updateAttendee,
    checkin,
    create,
    update,
    remove,
    setRsvp,
    applyCounts,
    applyOnline,
  };
});
