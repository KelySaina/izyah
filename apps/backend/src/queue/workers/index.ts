import { Worker } from 'bullmq';
import { createBullConnection } from '../../lib/redis';
import { QUEUE_NAMES } from '../index';
import { processMedia } from './media.worker';
import { processNotification } from './notification.worker';
import { runReminderScan } from '../../modules/notifications/reminder.service';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

const workers: Worker[] = [];
let reminderTimer: ReturnType<typeof setInterval> | null = null;

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

  // Event reminders: a DB-state-driven scan on an interval (see
  // reminder.service). Idempotent, so restarts and overlaps are harmless; runs
  // wherever the workers run (inline in dev, the worker service in prod).
  const scan = () => runReminderScan().catch((err) => logger.warn({ err }, 'reminder scan failed'));
  reminderTimer = setInterval(scan, env.REMINDER_SCAN_INTERVAL_MS);
  void scan(); // once at boot so a restart doesn't delay a due reminder

  logger.info(`⚙️  Workers started: ${workers.length} (+ reminder scan)`);
}

export async function stopWorkers(): Promise<void> {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
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
