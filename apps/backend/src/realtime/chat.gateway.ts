import type { Server, Socket } from 'socket.io';
import { redis } from '../lib/redis';
import { eventRoom } from './io';
import { createMessage } from '../modules/messages/message.service';
import { logger } from '../lib/logger';

const MAX_LEN = 2000;

/** Simple sliding-window chat flood guard: max 10 messages / 10s per user. */
async function allowMessage(userId: string): Promise<boolean> {
  const key = `rl:chat:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 10);
  return count <= 10;
}

export function registerChatGateway(io: Server, socket: Socket): void {
  const userId: string = socket.data.userId;

  socket.on('chat:message', async (payload: { eventId?: string; content?: string }, ack?: (r: unknown) => void) => {
    try {
      const eventId = payload?.eventId;
      const content = (payload?.content ?? '').toString().trim();
      if (!eventId || !content) return ack?.({ ok: false, error: 'invalid payload' });
      if (content.length > MAX_LEN) return ack?.({ ok: false, error: 'message too long' });
      if (!(await allowMessage(userId))) return ack?.({ ok: false, error: 'rate limited' });

      const message = await createMessage({ eventId, userId, content });
      io.to(eventRoom(eventId)).emit('chat:message', message);
      ack?.({ ok: true, message });
    } catch (err) {
      logger.warn({ err, userId }, 'chat:message failed');
      ack?.({ ok: false, error: 'internal error' });
    }
  });

  socket.on('chat:typing', (payload: { eventId?: string; isTyping?: boolean }) => {
    const eventId = payload?.eventId;
    if (typeof eventId !== 'string') return;
    socket.to(eventRoom(eventId)).emit('chat:typing', {
      eventId,
      userId,
      displayName: socket.data.displayName,
      isTyping: Boolean(payload?.isTyping),
    });
  });
}
