import type { Job } from 'bullmq';
import type { MediaJob } from '../index';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

/**
 * Media processing job. MVP scope keeps this minimal: mark the record READY.
 * Real processing (thumbnails, transcoding, EXIF strip, virus scan) plugs in
 * here without touching the request path — the API already returns immediately
 * after enqueueing.
 */
export async function processMedia(job: Job<MediaJob>): Promise<void> {
  const { mediaId } = job.data;
  logger.info({ mediaId }, 'processing media');

  await prisma.media.update({ where: { id: mediaId }, data: { status: 'PROCESSING' } });

  // TODO(v2): generate thumbnails / transcode video / strip metadata here.

  await prisma.media.update({ where: { id: mediaId }, data: { status: 'READY' } });
  logger.info({ mediaId }, 'media ready');
}
