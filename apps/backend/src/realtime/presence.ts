import type { Server, Socket } from 'socket.io';
import { redis } from '../lib/redis';
import { eventRoom } from './io';
import { logger } from '../lib/logger';

/**
 * Presence tracking: "N people are currently online at this event".
 *
 * A Redis hash per event maps userId -> connectionCount so multiple tabs /
 * devices for the same user count once. Presence is derived, ephemeral state;
 * on a cold start the hashes are simply empty again.
 */
const presenceKey = (eventId: string) => `presence:event:${eventId}`;

async function readPresence(eventId: string) {
  const raw = await redis.hgetall(presenceKey(eventId));
  const userIds = Object.keys(raw);
  return { count: userIds.length, userIds };
}

async function broadcastPresence(io: Server, eventId: string) {
  const presence = await readPresence(eventId);
  io.to(eventRoom(eventId)).emit('presence:update', { eventId, ...presence });
}

export function registerPresence(io: Server, socket: Socket): void {
  const userId: string = socket.data.userId;
  // Track which event rooms this socket joined so we can clean up on disconnect.
  const joined = new Set<string>();

  socket.on('presence:join', async (eventId: string) => {
    if (typeof eventId !== 'string') return;
    joined.add(eventId);
    await socket.join(eventRoom(eventId));
    await redis.hincrby(presenceKey(eventId), userId, 1);
    await broadcastPresence(io, eventId);
  });

  socket.on('presence:leave', async (eventId: string) => {
    if (typeof eventId !== 'string') return;
    joined.delete(eventId);
    await leave(eventId);
  });

  socket.on('disconnect', async () => {
    for (const eventId of joined) await leave(eventId);
    logger.debug({ sid: socket.id, userId }, 'socket disconnected');
  });

  async function leave(eventId: string) {
    const remaining = await redis.hincrby(presenceKey(eventId), userId, -1);
    if (remaining <= 0) await redis.hdel(presenceKey(eventId), userId);
    await socket.leave(eventRoom(eventId));
    await broadcastPresence(io, eventId);
  }
}

/** Read helper reused by the REST layer (attendee "online now" badge). */
export async function getOnlineCount(eventId: string): Promise<number> {
  return redis.hlen(presenceKey(eventId));
}
