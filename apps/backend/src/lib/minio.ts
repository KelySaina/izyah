import { Client as MinioClient } from 'minio';
import { env } from '../config/env';
import { logger } from './logger';

/** S3-compatible object storage client (MinIO). */
export const minio = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

export const BUCKETS = {
  media: env.MINIO_BUCKET_MEDIA,
  avatars: env.MINIO_BUCKET_AVATARS,
} as const;

/**
 * Ensure required buckets exist. `minio-init` handles this in Docker, but the
 * backend calls it on boot too so native dev works without the init container.
 */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await minio.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minio.makeBucket(bucket);
      logger.info({ bucket }, 'created bucket');
    }
  }
}

/** Build a browser-facing URL for an object stored in a public bucket. */
export function publicUrl(bucket: string, objectKey: string): string {
  return `${env.MINIO_PUBLIC_URL}/${bucket}/${objectKey}`;
}
