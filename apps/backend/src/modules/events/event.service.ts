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
  slug: string;
  visibility: Event['visibility'];
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
    slug: event.slug,
    visibility: event.visibility,
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
  const counts: RsvpCounts = { going: 0, maybe: 0, notGoing: 0, total: 0 };
  for (const row of grouped) {
    const n = row._count._all;
    counts.total += n;
    if (row.status === 'GOING') counts.going = n;
    else if (row.status === 'MAYBE') counts.maybe = n;
    else if (row.status === 'NOT_GOING') counts.notGoing = n;
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
        location: input.location ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        coverImage: input.coverImage ?? null,
        visibility: input.visibility ?? 'PUBLIC',
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
  return toEventDTO(event, { going: 1, maybe: 0, notGoing: 0, total: 1 });
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

  const events = await prisma.event.findMany({
    where,
    include: { creator: true },
    orderBy: { date: query.scope === 'past' ? 'desc' : 'asc' },
    take: query.limit,
  });

  // Batch counts to avoid N+1.
  const counts = await Promise.all(events.map((e) => computeCounts(e.id)));
  return events.map((e, i) => toEventDTO(e, counts[i]!));
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

async function assertCreator(eventId: string, userId: string): Promise<Event> {
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
  const event = await prisma.event.update({
    where: { id: eventId },
    data: input,
    include: { creator: true },
  });
  await cacheDel(cacheKeys.eventPublic(event.slug), cacheKeys.eventPublic(existing.id));
  const counts = await computeCounts(event.id);
  return toEventDTO(event, counts);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const existing = await assertCreator(eventId, userId);
  await prisma.event.delete({ where: { id: eventId } });
  await cacheDel(cacheKeys.eventPublic(existing.slug), cacheKeys.eventPublic(existing.id));
}
