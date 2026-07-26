#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — full-stack backup (Postgres + Redis + MinIO + .env).
#
# Runs automatically on a schedule inside the "backup" compose service
# (scripts/backup-cron.js, node-cron). For an on-demand backup, run it in
# that same container, so it can resolve postgres/redis/minio by name on the
# shared "izyah" docker network:
#   docker compose exec backup bash scripts/backup.sh
#
# Talks to Postgres/Redis/MinIO over the network as an ordinary client — no
# Docker socket, no `docker exec`/`docker cp`. Deliberately: giving an
# unattended, scheduled sidecar Docker Engine API access is one compromised
# dependency away from root on the host (the socket can spin up a new
# privileged, host-bind-mounted container — a `:ro` mount doesn't stop that,
# it only protects the socket *file*, not what the Engine API lets you do
# through it). See infra/backup/Dockerfile.
#
# Produces backups/izyah-backup-<timestamp>.tar.gz containing:
#   postgres.sql       pg_dumpall — every database + role (incl. Logto's, if
#                       account-linking is set up), so no schema/data is missed
#   redis-dump.rdb      Redis's own on-disk snapshot, fetched live over the
#                       wire (redis-cli --rdb)
#   minio-data.tar.gz   every uploaded photo/video/avatar, mirrored object-by-
#                       object out of each bucket via the S3 API (mc mirror)
#   env                 this box's .env — DB/MinIO passwords, SESSION_SECRET,
#                       OIDC/VAPID config
#
# The .env copy makes this archive as sensitive as your live secrets. Treat
# it like a password: scp it directly to wherever it's going, never email it,
# never commit it, delete local copies once you're done restoring elsewhere.
#
# Each run also prunes backups/ down to the BACKUP_KEEP (default 8) most
# recent archives, so running this on a schedule doesn't fill the disk.
#
# Use with scripts/restore.sh on the new box to move VPS providers without
# losing data. See that script's header for the full flow.
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

log()  { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[33m==> %s\033[0m\n' "$*" >&2; }
die()  { printf '\n\033[31m==> %s\033[0m\n' "$*" >&2; exit 1; }

[ -f .env ] || die ".env not found in $(pwd) — run this inside the backup container (docker compose exec backup bash scripts/backup.sh)."

read_env() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }

# Service names on the shared "izyah" docker network — same names docker
# compose resolves for every other container, no socket/exec required.
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
REDIS_HOST="${REDIS_HOST:-redis}"
MINIO_HOST="${MINIO_HOST:-minio}"

POSTGRES_USER="$(read_env POSTGRES_USER)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
[ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] || die "POSTGRES_USER/POSTGRES_PASSWORD not set in .env"

MINIO_PORT="$(read_env MINIO_PORT)"; MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ROOT_USER="$(read_env MINIO_ROOT_USER)"
MINIO_ROOT_PASSWORD="$(read_env MINIO_ROOT_PASSWORD)"
MINIO_BUCKET_MEDIA="$(read_env MINIO_BUCKET_MEDIA)"
MINIO_BUCKET_AVATARS="$(read_env MINIO_BUCKET_AVATARS)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

log "Dumping Postgres (all databases + roles)"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
  > "$WORKDIR/postgres.sql" || die "pg_dumpall failed — is postgres reachable at $POSTGRES_HOST? Nothing to back up."

if redis-cli -h "$REDIS_HOST" ping >/dev/null 2>&1; then
  log "Snapshotting Redis"
  redis-cli -h "$REDIS_HOST" --rdb "$WORKDIR/redis-dump.rdb" >/dev/null
else
  log "Redis isn't reachable — skipping (analytics counters/cache, not core data)"
fi

if [ -n "$MINIO_ROOT_USER" ] && curl -fsS "http://${MINIO_HOST}:${MINIO_PORT}/minio/health/live" >/dev/null 2>&1; then
  log "Mirroring MinIO object storage (uploaded media)"
  mc alias set backup-minio "http://${MINIO_HOST}:${MINIO_PORT}" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mkdir -p "$WORKDIR/minio-data"
  for bucket in "$MINIO_BUCKET_MEDIA" "$MINIO_BUCKET_AVATARS"; do
    [ -n "$bucket" ] || continue
    mc mirror --quiet "backup-minio/$bucket" "$WORKDIR/minio-data/$bucket" \
      || warn "Mirroring bucket '$bucket' failed — continuing with what succeeded"
  done
  tar czf "$WORKDIR/minio-data.tar.gz" -C "$WORKDIR" minio-data
  rm -rf "$WORKDIR/minio-data"
else
  log "MinIO isn't reachable — skipping (uploaded media will NOT be backed up!)"
fi

log "Copying .env"
cp .env "$WORKDIR/env"

mkdir -p backups
OUT="backups/izyah-backup-${STAMP}.tar.gz"
tar czf "$OUT" -C "$WORKDIR" .
chmod 600 "$OUT"
# This container runs as root — match ownership to whoever owns .env on the
# HOST (a real bind mount, the one thing here guaranteed to reflect host
# ownership — see infra/backup/Dockerfile), so the archive is readable/
# scp-able without sudo. Harmless no-op when already the case.
chown "$(stat -c '%u:%g' .env)" backups "$OUT" 2>/dev/null || true

log "Done: $OUT ($(du -h "$OUT" | cut -f1))"
echo "  This contains live secrets — copy it off this box securely, e.g. from your machine:"
echo "    scp <user>@<this-host>:$REPO_DIR/$OUT ."
echo "  then to the new VPS:"
echo "    scp izyah-backup-${STAMP}.tar.gz <user>@<new-host>:~/izyah/backups/"
echo "  ...and delete both copies once restored there."

# Retention — keep the KEEP most recent archives, delete the rest. Run on a
# schedule (the "backup" compose service), this is what stops backups/ from
# growing forever; override with BACKUP_KEEP if the default doesn't fit your
# schedule (e.g. more headroom for a more-frequent cadence).
KEEP="${BACKUP_KEEP:-8}"
mapfile -t existing < <(ls -1 backups/izyah-backup-*.tar.gz 2>/dev/null | sort)
total=${#existing[@]}
if [ "$total" -gt "$KEEP" ]; then
  stale=$((total - KEEP))
  log "Pruning ${stale} old backup(s), keeping the ${KEEP} most recent"
  for ((i = 0; i < stale; i++)); do
    echo "  rm ${existing[$i]}"
    rm -f "${existing[$i]}"
  done
fi
