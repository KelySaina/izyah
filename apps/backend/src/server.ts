import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { ensureBuckets } from './lib/minio';
import { initSocket, shutdownSocket } from './realtime/io';
import { startInlineWorkers, stopWorkers } from './queue/workers';

async function main() {
  // Make sure object storage buckets exist (no-op if minio-init already ran).
  await ensureBuckets().catch((err) => logger.warn({ err }, 'ensureBuckets failed'));

  const app = createApp();
  const server = createServer(app);

  // Attach Socket.IO (chat + presence) with the Redis adapter.
  await initSocket(server);

  // Optionally run background workers in-process (single-container dev).
  if (env.RUN_WORKER_INLINE) {
    await startInlineWorkers();
  }

  server.listen(env.PORT, () => {
    logger.info(`🚀 Izy'Ah API listening on :${env.PORT} (${env.NODE_ENV})`);
    logger.info(`📚 Docs at http://localhost:${env.PORT}/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await shutdownSocket().catch(() => undefined);
    await stopWorkers().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal boot error');
  process.exit(1);
});
