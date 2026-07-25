import type { Notification } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { enqueueNotification } from '../../queue';
import type { ListNotificationsQuery } from './notification.schemas';

export interface NotificationDTO {
  id: string;
  type: string;
  payload: Notification['payload'];
  read: boolean;
  createdAt: Date;
}

function toNotificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    payload: n.payload,
    read: n.read,
    createdAt: n.createdAt,
  };
}

export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
): Promise<{ notifications: NotificationDTO[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(query.unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications: rows.map(toNotificationDTO), unread };
}

export async function markRead(userId: string, id: string): Promise<NotificationDTO> {
  // Scope to the caller so one user can't read/flip another's notifications.
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Notification not found');
  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return toNotificationDTO(updated);
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { updated: result.count };
}

/** Fan out an event-wide announcement (new task, new poll, task claimed) to
 *  everyone still engaged with the event — including the actor themselves,
 *  so e.g. the host still hears about their own action, just phrased as
 *  "You" instead of their own name (`payload.displayName`). Excludes anyone
 *  who already declined, since a "Can't go" RSVP presumably doesn't care
 *  about its logistics. Unlike the single-recipient notifications
 *  elsewhere, this is one enqueue per participant. */
export async function notifyEventParticipants(
  eventId: string,
  actorUserId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const participants = await prisma.eventParticipant.findMany({
    where: { eventId, status: { not: 'NOT_GOING' } },
    select: { userId: true },
  });
  await Promise.all(
    participants.map((p) => {
      const isActor = p.userId === actorUserId;
      return enqueueNotification({
        userId: p.userId,
        type,
        payload: isActor ? { ...payload, displayName: 'You' } : payload,
      }).catch(() => undefined);
    }),
  );
}
