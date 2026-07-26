import { randomUUID } from 'node:crypto';
import type { RsvpStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { cacheDel, cacheKeys } from '../../lib/cache';
import { computeCounts, assertCreator, type RsvpCounts } from '../events/event.service';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { getIo, eventRoom } from '../../realtime/io';
import { track, type AnalyticsEvent } from '../../analytics/track';
import { enqueueNotification } from '../../queue';
import type { AttendeePatchInput } from './participant.schemas';

export interface AttendeeDTO {
  user: UserDTO;
  status: RsvpStatus;
  role: 'HOST' | 'GUEST';
  joinedAt: Date;
  // MIN_PAF / TICKET tracking. Never carries the raw ticketCode — that's
  // only ever returned to its own owner via getMyTicket, or consumed as
  // scan input via checkInByTicket. Exposing it here would let anyone
  // impersonate/pre-check-in another attendee.
  paid: boolean;
  checkedIn: boolean;
}

export interface MyTicketDTO {
  ticketCode: string;
  checkedIn: boolean;
  checkedInAt: Date | null;
}

export interface CheckinResultDTO {
  attendee: AttendeeDTO;
  alreadyCheckedIn: boolean;
}

const RSVP_ANALYTICS: Record<RsvpStatus, AnalyticsEvent> = {
  GOING: 'rsvp_going',
  MAYBE: 'rsvp_maybe',
  NOT_GOING: 'rsvp_not_going',
  WAITLIST: 'rsvp_waitlisted',
};

async function requireEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      creatorId: true,
      capacity: true,
      attendanceMode: true,
    },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

function toAttendeeDTO(row: {
  user: Parameters<typeof toUserDTO>[0];
  status: RsvpStatus;
  role: 'HOST' | 'GUEST';
  joinedAt: Date;
  paid: boolean;
  checkedIn: boolean;
}): AttendeeDTO {
  return {
    user: toUserDTO(row.user),
    status: row.status,
    role: row.role,
    joinedAt: row.joinedAt,
    paid: row.paid,
    checkedIn: row.checkedIn,
  };
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

  const participant = await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status: effectiveStatus },
    create: { eventId, userId, status: effectiveStatus },
  });

  // Mint a ticket the first time someone actually goes to a TICKET event.
  // Never regenerated once set — stable for the participant's whole
  // lifetime on this event, so un-RSVPing and coming back GOING keeps the
  // same QR working. The host never gets one — they're running the door,
  // not paying to get in.
  if (
    effectiveStatus === 'GOING' &&
    event.attendanceMode === 'TICKET' &&
    !participant.ticketCode &&
    userId !== event.creatorId
  ) {
    await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { ticketCode: randomUUID() },
    });
  }

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

  // Best-effort notifications — never block the RSVP response on these. The
  // host still hears about it even if they're the one RSVPing (phrased as
  // "You" — see notification.worker.ts / NotificationsSheet's text mapping).
  if (effectiveStatus === 'GOING' && !wasGoing) {
    void enqueueNotification({
      userId: event.creatorId,
      type: 'rsvp_going',
      payload: {
        eventId: event.id,
        eventSlug: event.slug,
        eventTitle: event.title,
        displayName: userId === event.creatorId ? 'You' : displayName,
      },
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
  return { counts: await computeCounts(eventId), attendees: rows.map(toAttendeeDTO) };
}

/** The caller's own ticket for a TICKET event, or null if there's nothing to
 *  show them (wrong mode, never RSVP'd GOING, host, etc). Always scoped to
 *  `userId`'s own row. */
export async function getMyTicket(eventId: string, userId: string): Promise<MyTicketDTO | null> {
  const event = await requireEvent(eventId);
  if (event.attendanceMode !== 'TICKET') return null;
  // The host is auto-added as GOING when they create the event (see
  // createEvent) — they're running the door, not paying to get in, so they
  // never get a ticket even though they're technically GOING.
  if (userId === event.creatorId) return null;

  const participant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!participant || participant.status !== 'GOING') return null;

  // Defensive fallback — setRsvp/updateEvent's backfill should already have
  // minted this, but never leave a GOING TICKET attendee ticketless.
  let ticketCode = participant.ticketCode;
  if (!ticketCode) {
    ticketCode = randomUUID();
    await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { ticketCode },
    });
  }

  return { ticketCode, checkedIn: participant.checkedIn, checkedInAt: participant.checkedInAt };
}

/** Host-only manual paid/checked-in toggle — the fallback for when scanning
 *  isn't available (no camera, MIN_PAF events, host error correction). */
export async function updateAttendee(
  actorUserId: string,
  eventId: string,
  targetUserId: string,
  patch: AttendeePatchInput,
): Promise<AttendeeDTO> {
  const event = await assertCreator(eventId, actorUserId);

  if (patch.paid !== undefined && event.attendanceMode !== 'MIN_PAF') {
    throw ApiError.badRequest('paid only applies to MIN_PAF events');
  }
  if (patch.checkedIn !== undefined && event.attendanceMode !== 'TICKET') {
    throw ApiError.badRequest('checkedIn only applies to TICKET events');
  }

  const target = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId: targetUserId } },
    include: { user: true },
  });
  if (!target) throw ApiError.notFound('Attendee not found');

  const updated = await prisma.eventParticipant.update({
    where: { id: target.id },
    data: {
      ...(patch.paid !== undefined ? { paid: patch.paid, paidAt: patch.paid ? new Date() : null } : {}),
      ...(patch.checkedIn !== undefined
        ? { checkedIn: patch.checkedIn, checkedInAt: patch.checkedIn ? new Date() : null }
        : {}),
    },
    include: { user: true },
  });
  return toAttendeeDTO(updated);
}

/** Host-only scan-by-code check-in. Idempotent: scanning an already
 *  checked-in ticket succeeds again with `alreadyCheckedIn: true` instead
 *  of throwing, since a phone camera will happily fire this multiple times
 *  for the same badge held steady in frame. */
export async function checkInByTicket(
  actorUserId: string,
  eventId: string,
  ticketCode: string,
): Promise<CheckinResultDTO> {
  const event = await assertCreator(eventId, actorUserId);
  if (event.attendanceMode !== 'TICKET') {
    throw ApiError.conflict('This event does not use ticket check-in');
  }

  const found = await prisma.eventParticipant.findUnique({
    where: { ticketCode },
    include: { user: true },
  });
  // Cross-event check: global uniqueness makes a true collision practically
  // impossible, but this turns "code copy-pasted from a different event"
  // into a clean 404 instead of silently checking someone into this event.
  if (!found || found.eventId !== eventId) {
    throw ApiError.notFound('Ticket not recognized for this event');
  }
  if (found.status !== 'GOING') {
    throw ApiError.conflict('This ticket is no longer valid — attendee is not marked as going');
  }

  if (found.checkedIn) {
    return { attendee: toAttendeeDTO(found), alreadyCheckedIn: true };
  }

  const updated = await prisma.eventParticipant.update({
    where: { id: found.id },
    data: { checkedIn: true, checkedInAt: new Date() },
    include: { user: true },
  });
  return { attendee: toAttendeeDTO(updated), alreadyCheckedIn: false };
}
