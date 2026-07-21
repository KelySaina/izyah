import type { RsvpStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { cacheDel, cacheKeys } from '../../lib/cache';
import { computeCounts, type RsvpCounts } from '../events/event.service';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { getIo, eventRoom } from '../../realtime/io';
import { track, type AnalyticsEvent } from '../../analytics/track';

export interface AttendeeDTO {
  user: UserDTO;
  status: RsvpStatus;
  role: 'HOST' | 'GUEST';
  joinedAt: Date;
}

const RSVP_ANALYTICS: Record<RsvpStatus, AnalyticsEvent> = {
  GOING: 'rsvp_going',
  MAYBE: 'rsvp_maybe',
  NOT_GOING: 'rsvp_not_going',
};

async function requireEvent(eventId: string): Promise<{ id: string; slug: string }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export async function setRsvp(
  eventId: string,
  userId: string,
  status: RsvpStatus,
): Promise<{ status: RsvpStatus; counts: RsvpCounts }> {
  const event = await requireEvent(eventId);

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status },
    create: { eventId, userId, status },
  });

  await cacheDel(cacheKeys.eventPublic(event.slug), cacheKeys.eventPublic(event.id));
  const counts = await computeCounts(eventId);
  await track(RSVP_ANALYTICS[status], { eventId });

  // Broadcast the new tallies so open event pages update live.
  try {
    getIo().to(eventRoom(eventId)).emit('rsvp:update', { eventId, counts });
  } catch {
    /* socket server not running (e.g. in tests) */
  }

  return { status, counts };
}

export async function listAttendees(
  eventId: string,
): Promise<{ counts: RsvpCounts; attendees: AttendeeDTO[] }> {
  await requireEvent(eventId);
  const rows = await prisma.eventParticipant.findMany({
    where: { eventId },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  const attendees: AttendeeDTO[] = rows.map((r) => ({
    user: toUserDTO(r.user),
    status: r.status,
    role: r.role,
    joinedAt: r.joinedAt,
  }));
  return { counts: await computeCounts(eventId), attendees };
}
