import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createPubSubPair } from '../lib/redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { isUuid } from '../utils/validation';
import { registerChatGateway } from './chat.gateway';
import { registerPresence } from './presence';

let io: SocketServer | null = null;
const pubsub = { pub: null as ReturnType<typeof createPubSubPair>['pubClient'] | null, sub: null as ReturnType<typeof createPubSubPair>['subClient'] | null };

export function eventRoom(eventId: string): string {
  return `event:${eventId}`;
}

/** Initialise Socket.IO, wire the Redis adapter and register gateways. */
export async function initSocket(server: HttpServer): Promise<SocketServer> {
  io = new SocketServer(server, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    path: '/socket.io',
  });

  // Redis adapter → horizontal scaling + cross-instance broadcasts.
  const { pubClient, subClient } = createPubSubPair();
  pubsub.pub = pubClient;
  pubsub.sub = subClient;
  io.adapter(createAdapter(pubClient, subClient));

  // Anonymous identity handshake: client sends { auth: { userId } }.
  io.use(async (socket, next) => {
    const userId =
      (socket.handshake.auth?.userId as string | undefined) ??
      (socket.handshake.query?.userId as string | undefined);
    if (!userId || !isUuid(userId)) {
      return next(new Error('unauthorized: missing X-User-ID'));
    }
    const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
    if (!user) return next(new Error('unauthorized: unknown user'));
    socket.data.userId = user.id;
    socket.data.displayName = user.displayName;
    socket.data.avatar = user.avatar;
    next();
  });

  io.on('connection', (socket) => {
    logger.debug({ sid: socket.id, userId: socket.data.userId }, 'socket connected');
    registerPresence(io!, socket);
    registerChatGateway(io!, socket);
  });

  logger.info('🔌 Socket.IO ready (redis adapter)');
  return io;
}

/** Access the live server from REST controllers (to broadcast side effects). */
export function getIo(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialised');
  return io;
}

export async function shutdownSocket(): Promise<void> {
  await io?.close();
  await pubsub.pub?.quit();
  await pubsub.sub?.quit();
  io = null;
}
