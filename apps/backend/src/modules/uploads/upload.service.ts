import { randomUUID } from 'node:crypto';
import { minio, BUCKETS, publicUrl } from '../../lib/minio';
import { sniffImage } from '../../lib/fileSniff';
import { ApiError } from '../../utils/http';

/**
 * Standalone image uploads for an event cover or a user avatar. Unlike the
 * media gallery, these do not create a DB row — they just store the object and
 * return its public URL, which the caller saves on the Event/User record.
 */
export type UploadKind = 'cover' | 'avatar';

const CONFIG: Record<UploadKind, { bucket: string; prefix: string }> = {
  cover: { bucket: BUCKETS.media, prefix: 'covers' },
  avatar: { bucket: BUCKETS.avatars, prefix: 'avatars' },
};

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-40);
  return cleaned || 'image';
}

export async function putImage(
  kind: UploadKind,
  file: Express.Multer.File,
): Promise<{ url: string; objectKey: string }> {
  const sniffed = sniffImage(file.buffer);
  if (!sniffed) throw ApiError.badRequest('Unsupported or unrecognized image file');

  const { bucket, prefix } = CONFIG[kind];
  const objectKey = `${prefix}/${randomUUID()}-${safeName(file.originalname)}`;
  await minio.putObject(bucket, objectKey, file.buffer, file.size, {
    'Content-Type': sniffed.mimeType,
  });
  return { url: publicUrl(bucket, objectKey), objectKey };
}
