import { Worker } from 'bullmq';
import { createBullConnection } from '../../lib/redis';
import { QUEUE_NAMES } from '../index';
import { processMedia } from './media.worker';
import { processNotification } from './notification.worker';
import { logger } from '../../lib/logger';

const workers: Worker[] = [];

/**
 * Start background workers. In dev the backend runs them in-process
 * (RUN_WORKER_INLINE=true). In production run this module as its own service
 * (`npm run worker`) so processing scales independently of the API.
 */
export async function startInlineWorkers(): Promise<void> {
  const connection = createBullConnection();

  workers.push(
    new Worker(QUEUE_NAMES.media, processMedia, { connection, concurrency: 3 }),
    new Worker(QUEUE_NAMES.notifications, processNotification, { connection, concurrency: 5 }),
  );

  for (const w of workers) {
    w.on('failed', (job, err) => logger.warn({ jobId: job?.id, err }, 'job failed'));
  }
  logger.info(`⚙️  Workers started: ${workers.length}`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

// Allow running standalone: `tsx src/queue/workers/index.ts`
if (require.main === module) {
  startInlineWorkers().catch((err) => {
    logger.error({ err }, 'worker boot failed');
    process.exit(1);
  });
}
