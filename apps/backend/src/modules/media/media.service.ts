import type { Media, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { track } from '../../analytics/track';
import { minio, BUCKETS, publicUrl } from '../../lib/minio';
import { enqueueMediaProcessing } from '../../queue';
import type { ListMediaQuery } from './media.schemas';

export interface MediaDTO {
  id: string;
  eventId: string;
  url: string;
  type: Media['type'];
  status: Media['status'];
  createdAt: Date;
  user: UserDTO;
}

type MediaWithUser = Media & { user: User };

function toMediaDTO(media: MediaWithUser): MediaDTO {
  return {
    id: media.id,
    eventId: media.eventId,
    url: media.url,
    type: media.type,
    status: media.status,
    createdAt: media.createdAt,
    user: toUserDTO(media.user),
  };
}

async function assertEventExists(eventId: string): Promise<void> {
  const exists = await prisma.event.count({ where: { id: eventId } });
  if (!exists) throw ApiError.notFound('Event not found');
}

export interface UploadMediaParams {
  eventId: string;
  userId: string;
  file: Express.Multer.File;
}

/**
 * Store an uploaded asset in MinIO, record it as PENDING, and hand it to the
 * media worker for transcode / thumbnailing. The row is returned enriched with
 * its uploader so the client can render attribution immediately.
 */
export async function uploadMedia(params: UploadMediaParams): Promise<MediaDTO> {
  const { eventId, userId, file } = params;
  await assertEventExists(eventId);

  const type = file.mimetype.startsWith('image/') ? 'IMAGE' : 'VIDEO';
  // Collapse the original filename to a storage-safe token, namespaced by event.
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${eventId}/${randomUUID()}-${safeName}`;

  await minio.putObject(BUCKETS.media, objectKey, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });

  const media = await prisma.media.create({
    data: {
      eventId,
      userId,
      objectKey,
      url: publicUrl(BUCKETS.media, objectKey),
      type,
      status: 'PENDING',
      sizeBytes: file.size,
    },
    include: { user: true },
  });

  await enqueueMediaProcessing({ mediaId: media.id, eventId, objectKey, type });
  await track('media_uploaded', { eventId });

  return toMediaDTO(media);
}

export async function listMedia(eventId: string, query: ListMediaQuery): Promise<MediaDTO[]> {
  await assertEventExists(eventId);
  const rows = await prisma.media.findMany({
    where: { eventId, ...(query.before ? { createdAt: { lt: query.before } } : {}) },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  return rows.map(toMediaDTO);
}
