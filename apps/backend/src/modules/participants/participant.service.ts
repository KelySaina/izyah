import type { RsvpStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { cacheDel, cacheKeys } from '../../lib/cache';
import { computeCounts, type RsvpCounts } from '../events/event.service';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { getIo, eventRoom } from '../../realtime/io';
import { track, type AnalyticsEvent } from '../../analytics/track';
import { enqueueNotification } from '../../queue';

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
  WAITLIST: 'rsvp_waitlisted',
};

async function requireEvent(
  eventId: string,
): Promise<{ id: string; slug: string; title: string; creatorId: string; capacity: number | null }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, title: true, creatorId: true, capacity: true },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export async function setRsvp(
  eventId: string,
  userId: string,
  displayName: string,
  status: RsvpStatus,
): Promise<{ status: RsvpStatus; counts: RsvpCounts }> {
  const event = await requireEvent(eventId);

  const existing = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  const wasGoing = existing?.status === 'GOING';

  // Once GOING is full, new/upgrading joiners land on the waitlist instead.
  // Someone already GOING keeps their spot (e.g. re-confirming doesn't bump them).
  let effectiveStatus: RsvpStatus = status;
  if (status === 'GOING' && event.capacity != null && !wasGoing) {
    const goingCount = await prisma.eventParticipant.count({
      where: { eventId, status: 'GOING' },
    });
    if (goingCount >= event.capacity) effectiveStatus = 'WAITLIST';
  }

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status: effectiveStatus },
    create: { eventId, userId, status: effectiveStatus },
  });

  // A GOING slot just freed up — promote whoever's been waiting longest.
  let promotedUserId: string | null = null;
  if (wasGoing && effectiveStatus !== 'GOING' && event.capacity != null) {
    const nextInLine = await prisma.eventParticipant.findFirst({
      where: { eventId, status: 'WAITLIST' },
      orderBy: { joinedAt: 'asc' },
    });
    if (nextInLine) {
      await prisma.eventParticipant.update({
        where: { id: nextInLine.id },
        data: { status: 'GOING' },
      });
      promotedUserId = nextInLine.userId;
    }
  }

  await cacheDel(cacheKeys.eventPublic(event.slug), cacheKeys.eventPublic(event.id));
  const counts = await computeCounts(eventId);
  await track(RSVP_ANALYTICS[effectiveStatus], { eventId });

  // Broadcast the new tallies so open event pages update live.
  try {
    getIo().to(eventRoom(eventId)).emit('rsvp:update', { eventId, counts });
  } catch {
    /* socket server not running (e.g. in tests) */
  }

  // Best-effort notifications — never block the RSVP response on these.
  if (effectiveStatus === 'GOING' && !wasGoing && userId !== event.creatorId) {
    void enqueueNotification({
      userId: event.creatorId,
      type: 'rsvp_going',
      payload: { eventId: event.id, eventSlug: event.slug, eventTitle: event.title, displayName },
    }).catch(() => undefined);
  }
  if (promotedUserId) {
    void enqueueNotification({
      userId: promotedUserId,
      type: 'waitlist_promoted',
      payload: { eventId: event.id, eventSlug: event.slug, eventTitle: event.title },
    }).catch(() => undefined);
  }

  return { status: effectiveStatus, counts };
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
