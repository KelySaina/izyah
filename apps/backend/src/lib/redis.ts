import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Redis connection factory. We keep several logically separate clients:
 *  - `redis`        : general commands (cache, presence, rate limit store)
 *  - pub/sub pair   : created on demand by the Socket.IO adapter
 *  - BullMQ         : creates its own connections from `redisConnectionOptions`
 *
 * BullMQ requires `maxRetriesPerRequest: null`, so we expose raw options too.
 */
export const redisConnectionOptions = {
  // ioredis accepts a URL via the constructor; for BullMQ we pass discrete opts.
  // Parsed lazily below.
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

function createClient(role: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
  client.on('error', (err) => logger.error({ err, role }, 'redis error'));
  client.on('connect', () => logger.debug({ role }, 'redis connected'));
  return client;
}

/** Primary client for app-level operations. */
export const redis = createClient('primary');

/** Fresh clients for the Socket.IO Redis adapter (must not be shared). */
export const createPubSubPair = () => ({
  pubClient: createClient('pub'),
  subClient: createClient('sub'),
});

/** A dedicated connection for BullMQ (queues + workers). */
export const createBullConnection = () => createClient('bull');
