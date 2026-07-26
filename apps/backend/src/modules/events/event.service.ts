import { randomUUID } from 'node:crypto';
import type { Event, Prisma, RsvpStatus, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { isUuid } from '../../utils/validation';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { cacheGet, cacheSet, cacheDel, cacheKeys } from '../../lib/cache';
import { getOnlineCount } from '../../realtime/presence';
import { track } from '../../analytics/track';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from './event.schemas';

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
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  coverImage: string | null;
  capacity: number | null;
  slug: string;
  visibility: Event['visibility'];
  attendanceMode: Event['attendanceMode'];
  minPafAmount: number | null;
  ticketPrice: number | null;
  creatorId: string;
  creator?: UserDTO;
  createdAt: Date;
  counts: RsvpCounts;
  viewerStatus?: RsvpStatus | null;
  onlineCount?: number;
}

type EventWithCreator = Event & { creator?: User };

function toEventDTO(event: EventWithCreator, counts: RsvpCounts): EventDTO {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    latitude: event.latitude,
    longitude: event.longitude,
    coverImage: event.coverImage,
    capacity: event.capacity,
    slug: event.slug,
    visibility: event.visibility,
    attendanceMode: event.attendanceMode,
    minPafAmount: event.minPafAmount,
    ticketPrice: event.ticketPrice,
    creatorId: event.creatorId,
    creator: event.creator ? toUserDTO(event.creator) : undefined,
    createdAt: event.createdAt,
    counts,
  };
}

export async function computeCounts(eventId: string): Promise<RsvpCounts> {
  const grouped = await prisma.eventParticipant.groupBy({
    by: ['status'],
    where: { eventId },
    _count: { _all: true },
  });
  const counts: RsvpCounts = { going: 0, maybe: 0, notGoing: 0, waitlist: 0, total: 0 };
  for (const row of grouped) {
    const n = row._count._all;
    counts.total += n;
    if (row.status === 'GOING') counts.going = n;
    else if (row.status === 'MAYBE') counts.maybe = n;
    else if (row.status === 'NOT_GOING') counts.notGoing = n;
    else if (row.status === 'WAITLIST') counts.waitlist = n;
  }
  return counts;
}

export async function createEvent(creatorId: string, input: CreateEventInput): Promise<EventDTO> {
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        date: input.date,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        location: input.location,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        coverImage: input.coverImage ?? null,
        capacity: input.capacity ?? null,
        visibility: input.visibility,
        attendanceMode: input.attendanceMode,
        minPafAmount: input.minPafAmount ?? null,
        ticketPrice: input.ticketPrice ?? null,
        creatorId,
      },
      include: { creator: true },
    });
    // Creator is automatically a HOST who is GOING.
    await tx.eventParticipant.create({
      data: { eventId: created.id, userId: creatorId, status: 'GOING', role: 'HOST' },
    });
    return created;
  });

  await track('event_created', { eventId: event.id });
  return toEventDTO(event, { going: 1, maybe: 0, notGoing: 0, waitlist: 0, total: 1 });
}

/** Popularity signal for the public discovery feed: attendance + waitlist
 *  demand (oversubscription is a stronger signal than capacity allows for),
 *  with a same-week boost so something happening imminently can surface
 *  over a bigger event that's still weeks out. */
function trendingScore(event: EventDTO): number {
  const attendance = event.counts.going + event.counts.waitlist * 0.5;
  const daysAway = Math.max(0, (event.date.getTime() - Date.now()) / 86_400_000);
  const soonBoost = daysAway <= 1 ? 1.5 : daysAway <= 7 ? 1.2 : 1;
  return attendance * soonBoost;
}

export async function listEvents(userId: string, query: ListEventsQuery): Promise<EventDTO[]> {
  // Events are day-granular: a date-only input is stored at 00:00 UTC. Bucket by
  // the START of today (UTC) so an event dated *today* counts as upcoming for the
  // whole day — comparing against `new Date()` would wrongly file it under past.
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let where: Prisma.EventWhereInput;

  if (query.scope === 'mine') {
    where = { OR: [{ creatorId: userId }, { participants: { some: { userId } } }] };
  } else if (query.scope === 'past') {
    where = { date: { lt: todayStart }, participants: { some: { userId } } };
  } else if (query.scope === 'public') {
    // Discovery feed: upcoming PUBLIC events I'm not already involved in.
    where = {
      date: { gte: todayStart },
      visibility: 'PUBLIC',
      NOT: { participants: { some: { userId } } },
    };
  } else {
    // upcoming: events I'm involved in that haven't happened yet.
    where = { date: { gte: todayStart }, participants: { some: { userId } } };
  }

  // Trending needs a wider candidate pool to rank before truncating to the
  // requested page size, since popularity isn't something Postgres can sort
  // by directly here (counts are computed per-event below, not a column).
  const trending = query.scope === 'public';

  const events = await prisma.event.findMany({
    where,
    include: { creator: true },
    orderBy: { date: query.scope === 'past' ? 'desc' : 'asc' },
    take: trending ? Math.min(Math.max(query.limit * 4, 50), 200) : query.limit,
  });

  // Batch counts to avoid N+1.
  const counts = await Promise.all(events.map((e) => computeCounts(e.id)));
  let dtos = events.map((e, i) => toEventDTO(e, counts[i]!));

  if (trending) {
    dtos = dtos.sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, query.limit);
  }

  return dtos;
}

async function findEventCore(idOrSlug: string): Promise<EventWithCreator> {
  const where = isUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
  const event = await prisma.event.findUnique({ where, include: { creator: true } });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export async function getEvent(idOrSlug: string, viewerId?: string): Promise<EventDTO> {
  // Public, viewer-independent pages are cache-aside (spec: cache public pages).
  const anonymous = !viewerId;

  let dto: EventDTO | null = null;
  if (anonymous) {
    const cached = await cacheGet<EventDTO>(cacheKeys.eventPublic(idOrSlug));
    if (cached) dto = cached;
  }

  if (!dto) {
    const event = await findEventCore(idOrSlug);
    const counts = await computeCounts(event.id);
    dto = toEventDTO(event, counts);
    if (anonymous && event.visibility === 'PUBLIC') {
      await cacheSet(cacheKeys.eventPublic(idOrSlug), dto, 30);
    }
  }

  // Viewer-specific + realtime fields are always fresh.
  dto.onlineCount = await getOnlineCount(dto.id).catch(() => 0);
  if (viewerId) {
    const p = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: dto.id, userId: viewerId } },
    });
    dto.viewerStatus = p?.status ?? null;
  }
  return dto;
}

export async function assertCreator(eventId: string, userId: string): Promise<Event> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.creatorId !== userId) throw ApiError.forbidden('Only the creator can modify this event');
  return event;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: UpdateEventInput,
): Promise<EventDTO> {
  const existing = await assertCreator(eventId, userId);

  // The amount fields belong to whichever mode is now in effect — null out
  // the other one so a MIN_PAF->TICKET (or ->NONE) switch doesn't leave a
  // stale amount from the old mode lingering (Zod already required the new
  // mode's own amount be present alongside it, see event.schemas.ts).
  const data: UpdateEventInput = { ...input };
  if (input.attendanceMode !== undefined) {
    if (input.attendanceMode !== 'MIN_PAF') data.minPafAmount = null;
    if (input.attendanceMode !== 'TICKET') data.ticketPrice = null;
  }

  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data,
      include: { creator: true },
    });
    // Switching an event into TICKET mode shouldn't leave already-GOING
    // attendees ticketless just because they RSVP'd before the switch. The
    // host is excluded — they never get a ticket (see getMyTicket).
    if (updated.attendanceMode === 'TICKET') {
      const missing = await tx.eventParticipant.findMany({
        where: { eventId, status: 'GOING', ticketCode: null, userId: { not: updated.creatorId } },
        select: { id: true },
      });
      await Promise.all(
        missing.map((p) => tx.eventParticipant.update({ where: { id: p.id }, data: { ticketCode: randomUUID() } })),
      );
    }
    return updated;
  });

  // Mode changes never clear existing paid/checkedIn/ticketCode history on
  // EventParticipant rows — only what the frontend currently surfaces
  // changes. Don't "helpfully" add a cleanup step here.
  await cacheDel(cacheKeys.eventPublic(event.slug), cacheKeys.eventPublic(existing.id));
  const counts = await computeCounts(event.id);
  return toEventDTO(event, counts);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const existing = await assertCreator(eventId, userId);
  await prisma.event.delete({ where: { id: eventId } });
  await cacheDel(cacheKeys.eventPublic(existing.slug), cacheKeys.eventPublic(existing.id));
}
