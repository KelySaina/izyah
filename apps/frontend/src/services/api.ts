import { getToken } from './session';
import type {
  AttendeeDTO,
  CheckinResultDTO,
  CreateEventInput,
  CreatePollInput,
  AnalyticsResult,
  EventDTO,
  MediaDTO,
  MeDTO,
  MessageDTO,
  MyTicketDTO,
  NotificationDTO,
  PollDTO,
  RsvpCounts,
  RsvpStatus,
  TaskDTO,
  UpdateEventInput,
  UserDTO,
} from '@/types';

const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * `validate.ts` attaches Zod's per-field errors as `details` alongside the
 * generic "Validation failed" message — surface the first field-level
 * message (e.g. "String must contain at most 80 character(s)") instead of
 * the generic one whenever it's present, so a toast tells the user what was
 * actually wrong.
 */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong';
  const fieldErrors = err.details as Record<string, string[] | undefined> | undefined;
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const messages of Object.values(fieldErrors)) {
      if (messages?.length) return messages[0]!;
    }
  }
  return err.message;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** When true, `body` is sent as-is (FormData) without JSON headers. */
  form?: boolean;
  /** Skip the Authorization header (used by the bootstrap call). */
  anonymous?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(BASE + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && !opts.anonymous) headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.body as BodyInit;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), { method: opts.method ?? 'GET', headers, body });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data?.error?.details);
  }
  return data as T;
}

/** Typed API surface — grouped by resource, mirrors the backend routes. */
export const api = {
  auth: {
    /** Bootstrap a fresh anonymous identity + its signed session token. */
    anonymous: () =>
      request<{ user: MeDTO; token: string }>('/auth/anonymous', {
        method: 'POST',
        anonymous: true,
      }),
    /** The caller's own identity (private projection). */
    me: () => request<MeDTO>('/auth/me'),
    /** Exchange a verified OIDC ID token for a session (claim / recover). */
    link: (idToken: string) =>
      request<{ user: MeDTO; token: string }>('/auth/link', { method: 'POST', body: { idToken } }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },
  users: {
    me: () => request<MeDTO>('/users/me'),
    updateMe: (input: { displayName?: string; avatar?: string }) =>
      request<MeDTO>('/users/me', { method: 'PATCH', body: input }),
    get: (id: string) => request<UserDTO>(`/users/${id}`),
    myAnalytics: () => request<AnalyticsResult>('/users/me/analytics'),
  },
  events: {
    list: (scope: 'upcoming' | 'mine' | 'past' | 'public' = 'upcoming') =>
      request<{ events: EventDTO[] }>('/events', { query: { scope } }).then((r) => r.events),
    get: (idOrSlug: string) => request<EventDTO>(`/events/${idOrSlug}`),
    create: (input: CreateEventInput) =>
      request<EventDTO>('/events', { method: 'POST', body: input }),
    update: (id: string, input: UpdateEventInput) =>
      request<EventDTO>(`/events/${id}`, { method: 'PATCH', body: input }),
    remove: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
    // Host-only — 403s for anyone but the creator.
    analytics: (id: string) => request<AnalyticsResult>(`/events/${id}/analytics`),
  },
  participants: {
    rsvp: (eventId: string, status: RsvpStatus) =>
      request<{ status: RsvpStatus; counts: RsvpCounts }>(`/events/${eventId}/rsvp`, {
        method: 'PUT',
        body: { status },
      }),
    attendees: (eventId: string) =>
      request<{ counts: RsvpCounts; attendees: AttendeeDTO[] }>(
        `/events/${eventId}/participants`,
      ),
    myTicket: (eventId: string) =>
      request<{ ticket: MyTicketDTO | null }>(`/events/${eventId}/participants/me/ticket`),
    updateAttendee: (eventId: string, userId: string, patch: { paid?: boolean; checkedIn?: boolean }) =>
      request<AttendeeDTO>(`/events/${eventId}/participants/${userId}`, {
        method: 'PATCH',
        body: patch,
      }),
    checkin: (eventId: string, ticketCode: string) =>
      request<CheckinResultDTO>(`/events/${eventId}/participants/checkin`, {
        method: 'POST',
        body: { ticketCode },
      }),
  },
  messages: {
    list: (eventId: string, before?: string) =>
      request<{ messages: MessageDTO[] }>(`/events/${eventId}/messages`, {
        query: { before },
      }).then((r) => r.messages),
    post: (eventId: string, content: string) =>
      request<MessageDTO>(`/events/${eventId}/messages`, { method: 'POST', body: { content } }),
  },
  media: {
    list: (eventId: string, before?: string) =>
      request<{ media: MediaDTO[] }>(`/events/${eventId}/media`, { query: { before } }).then(
        (r) => r.media,
      ),
    upload: (eventId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<MediaDTO>(`/events/${eventId}/media`, {
        method: 'POST',
        form: true,
        body: fd,
      });
    },
  },
  tasks: {
    list: (eventId: string) =>
      request<{ tasks: TaskDTO[] }>(`/events/${eventId}/tasks`).then((r) => r.tasks),
    create: (eventId: string, title: string) =>
      request<TaskDTO>(`/events/${eventId}/tasks`, { method: 'POST', body: { title } }),
    claim: (eventId: string, taskId: string) =>
      request<TaskDTO>(`/events/${eventId}/tasks/${taskId}/claim`, { method: 'POST' }),
    release: (eventId: string, taskId: string) =>
      request<TaskDTO>(`/events/${eventId}/tasks/${taskId}/release`, { method: 'POST' }),
    update: (eventId: string, taskId: string, patch: { title?: string; status?: string }) =>
      request<TaskDTO>(`/events/${eventId}/tasks/${taskId}`, { method: 'PATCH', body: patch }),
  },
  polls: {
    list: (eventId: string) =>
      request<{ polls: PollDTO[] }>(`/events/${eventId}/polls`).then((r) => r.polls),
    create: (eventId: string, input: CreatePollInput) =>
      request<PollDTO>(`/events/${eventId}/polls`, { method: 'POST', body: input }),
    vote: (eventId: string, pollId: string, optionId: string) =>
      request<PollDTO>(`/events/${eventId}/polls/${pollId}/vote`, {
        method: 'POST',
        body: { optionId },
      }),
  },
  notifications: {
    list: () => request<{ notifications: NotificationDTO[]; unread: number }>('/notifications'),
    read: (id: string) => request<NotificationDTO>(`/notifications/${id}/read`, { method: 'POST' }),
    readAll: () => request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    vapidPublicKey: () => request<{ key: string | null }>('/notifications/push/vapid-public-key'),
    subscribePush: (sub: PushSubscriptionJSON) =>
      request<void>('/notifications/push/subscribe', { method: 'POST', body: sub }),
    unsubscribePush: (endpoint: string) =>
      request<void>('/notifications/push/unsubscribe', { method: 'POST', body: { endpoint } }),
  },
  uploads: {
    image: (kind: 'cover' | 'avatar', file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<{ url: string; objectKey: string }>(`/uploads/${kind}`, {
        method: 'POST',
        form: true,
        body: fd,
      });
    },
  },
};
