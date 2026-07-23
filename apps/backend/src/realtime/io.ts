import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createPubSubPair } from '../lib/redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { verifySessionToken, looksLikeJwt } from '../lib/token';
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

  // Identity handshake: client sends { auth: { token } } — the same signed
  // session token used for REST. The raw user id is no longer accepted.
  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    // OIDC bearer tokens (JWTs) are wired in M2; only session tokens for now.
    if (!token || looksLikeJwt(token)) return next(new Error('unauthorized: missing token'));
    const claims = verifySessionToken(token);
    if (!claims) return next(new Error('unauthorized: invalid token'));
    const user = await prisma.user.findUnique({ where: { id: claims.sub } }).catch(() => null);
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
