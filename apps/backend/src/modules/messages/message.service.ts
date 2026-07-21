import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { track } from '../../analytics/track';
import type { ListMessagesQuery } from './message.schemas';

export interface MessageDTO {
  id: string;
  eventId: string;
  content: string;
  createdAt: Date;
  user: UserDTO;
}

async function assertEventExists(eventId: string): Promise<void> {
  const exists = await prisma.event.count({ where: { id: eventId } });
  if (!exists) throw ApiError.notFound('Event not found');
}

/**
 * Persist a chat message and return it enriched with author info.
 * Broadcasting is the caller's responsibility (REST controller or WS gateway),
 * so this stays side-effect-light and reusable from both paths.
 */
export async function createMessage(params: {
  eventId: string;
  userId: string;
  content: string;
}): Promise<MessageDTO> {
  await assertEventExists(params.eventId);
  const message = await prisma.message.create({
    data: { eventId: params.eventId, userId: params.userId, content: params.content },
    include: { user: true },
  });
  await track('message_sent', { eventId: params.eventId });
  return {
    id: message.id,
    eventId: message.eventId,
    content: message.content,
    createdAt: message.createdAt,
    user: toUserDTO(message.user),
  };
}

export async function listMessages(
  eventId: string,
  query: ListMessagesQuery,
): Promise<MessageDTO[]> {
  await assertEventExists(eventId);
  const rows = await prisma.message.findMany({
    where: { eventId, ...(query.before ? { createdAt: { lt: query.before } } : {}) },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  // Return chronological (oldest first) for straightforward rendering.
  return rows.reverse().map((m) => ({
    id: m.id,
    eventId: m.eventId,
    content: m.content,
    createdAt: m.createdAt,
    user: toUserDTO(m.user),
  }));
}
