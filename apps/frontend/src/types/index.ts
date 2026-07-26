// Client-side mirror of the backend DTOs. Over the wire, Prisma `Date` values
// are serialised to ISO strings, so date fields are typed as `string` here.

export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING' | 'WAITLIST';
export type ParticipantRole = 'HOST' | 'GUEST';
export type EventVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export type AttendanceMode = 'NONE' | 'MIN_PAF' | 'TICKET';
export type MediaType = 'IMAGE' | 'VIDEO';
export type MediaStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type TaskStatus = 'OPEN' | 'CLAIMED' | 'DONE';

export interface UserDTO {
  id: string;
  displayName: string;
  avatar: string; // "#RRGGBB" color token OR an object URL
  createdAt: string;
  lastSeenAt: string;
}

/** Private projection of the current user (GET /auth/me). Carries
 *  account-linking state; never returned for other users. */
export interface MeDTO extends UserDTO {
  email: string | null;
  isClaimed: boolean;
}

export interface RsvpCounts {
  going: number;
  maybe: number;
  notGoing: number;
  waitlist: number;
  total: number;
}

export interface EventDTO {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  coverImage: string | null;
  capacity: number | null;
  slug: string;
  visibility: EventVisibility;
  attendanceMode: AttendanceMode;
  minPafAmount: number | null;
  ticketPrice: number | null;
  creatorId: string;
  creator?: UserDTO;
  createdAt: string;
  counts: RsvpCounts;
  viewerStatus?: RsvpStatus | null;
  onlineCount?: number;
}

export interface AttendeeDTO {
  user: UserDTO;
  status: RsvpStatus;
  role: ParticipantRole;
  joinedAt: string;
  paid: boolean;
  checkedIn: boolean;
}

export interface MyTicketDTO {
  ticketCode: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface CheckinResultDTO {
  attendee: AttendeeDTO;
  alreadyCheckedIn: boolean;
}

export interface MessageDTO {
  id: string;
  eventId: string;
  content: string;
  createdAt: string;
  user: UserDTO;
}

export interface MediaDTO {
  id: string;
  eventId: string;
  url: string;
  type: MediaType;
  status: MediaStatus;
  createdAt: string;
  user: UserDTO;
}

export interface TaskDTO {
  id: string;
  eventId: string;
  title: string;
  status: TaskStatus;
  assignedUserId: string | null;
  assignedUser: UserDTO | null;
  createdAt: string;
}

export interface PollOptionDTO {
  id: string;
  text: string;
  votes: number;
}

export interface PollDTO {
  id: string;
  eventId: string;
  question: string;
  closesAt: string | null;
  createdAt: string;
  options: PollOptionDTO[];
  totalVotes: number;
  viewerOptionId: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

// ---- Inputs -----------------------------------------------------------------
export interface CreateEventInput {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  coverImage?: string;
  capacity?: number | null;
  visibility?: EventVisibility;
  attendanceMode?: AttendanceMode;
  minPafAmount?: number | null;
  ticketPrice?: number | null;
}
export type UpdateEventInput = Partial<CreateEventInput>;

export interface CreatePollInput {
  question: string;
  options: string[];
  closesAt?: string;
}

// ---- Analytics (per-event, host-only; and "my" — aggregated across every
// event a user has created). Both endpoints share this shape. -----------------
export type AnalyticsKey =
  | 'event_created'
  | 'invitation_opened'
  | 'rsvp_going'
  | 'rsvp_maybe'
  | 'rsvp_not_going'
  | 'rsvp_waitlisted'
  | 'message_sent'
  | 'media_uploaded';

export interface AnalyticsDailyPoint {
  date: string;
  counts: Partial<Record<AnalyticsKey, number>>;
}

export interface AnalyticsResult {
  totals: Partial<Record<AnalyticsKey, number>>;
  daily: AnalyticsDailyPoint[];
}

// ---- Realtime events (Socket.IO payloads) -----------------------------------
export interface PresenceUpdate {
  eventId: string;
  count: number;
  userIds: string[];
}
export interface TypingUpdate {
  eventId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}
export interface RsvpUpdate {
  eventId: string;
  counts: RsvpCounts;
}
