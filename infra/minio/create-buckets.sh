#!/bin/sh
# Initialise MinIO buckets and access policies. Idempotent.
set -eu

echo "==> Waiting for MinIO..."
until mc alias set izyah "http://minio:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 1
done

echo "==> Creating buckets"
mc mb --ignore-existing "izyah/${MINIO_BUCKET_MEDIA}"
mc mb --ignore-existing "izyah/${MINIO_BUCKET_AVATARS}"

# Media + avatars are publicly readable (downloadable via URL) but only the
# backend (root creds) can write. Uploads go through the API, never directly.
echo "==> Applying public-read (download) policy"
mc anonymous set download "izyah/${MINIO_BUCKET_MEDIA}"
mc anonymous set download "izyah/${MINIO_BUCKET_AVATARS}"

echo "==> MinIO ready."
