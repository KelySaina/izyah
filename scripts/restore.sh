#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — restore onto a new VPS from a scripts/backup.sh archive.
#
# Moving providers/boxes, keeping your data:
#   1. On the OLD box:  bash scripts/backup.sh          -> backups/izyah-backup-*.tar.gz
#   2. Copy that file to the NEW box (scp), into ~/izyah/backups/.
#   3. On the NEW box:  ./setup.sh --domain ... (or --nip/--http)
#        This installs Docker/Traefik and writes a fresh .env +
#        docker-compose.prod.yml, but does NOT start the stack — exactly the
#        state this script expects.
#   4. On the NEW box:  bash scripts/restore.sh backups/izyah-backup-*.tar.gz
#        Overwrites the just-generated .env with the backed-up one (so DB/
#        MinIO passwords and SESSION_SECRET match the restored data, and
#        existing users' sessions keep working), restores Postgres/Redis/
#        MinIO, then brings the whole stack up itself.
#
# If the new box uses a DIFFERENT domain/IP than the old one, edit the
# APP_DOMAIN/API_DOMAIN/etc. lines in .env after this script finishes (before
# that, Traefik isn't up yet, so there's nothing to restart) — the restore
# itself only cares about the secrets, never the domain fields.
#
# Safe to re-run: your pre-existing .env (if any) is saved as .env.bak-<ts>
# rather than overwritten silently, and you're prompted before it's replaced.
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Pin the compose project name — see the same note in backup.sh.
export COMPOSE_PROJECT_NAME=izyah

log()  { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[33m==> %s\033[0m\n' "$*" >&2; }
die()  { printf '\n\033[31m==> %s\033[0m\n' "$*" >&2; exit 1; }

ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ] || die "Usage: bash scripts/restore.sh <path-to-izyah-backup-*.tar.gz>"
[ -f "$ARCHIVE" ] || die "Not found: $ARCHIVE"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml"
[ -f docker-compose.prod.yml ] || die \
  "docker-compose.prod.yml not found — run ./setup.sh on this box first (it shouldn't start the stack; this script does)."

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

log "Extracting $ARCHIVE"
tar xzf "$ARCHIVE" -C "$WORKDIR"
for f in postgres.sql env; do
  [ -f "$WORKDIR/$f" ] || die "Archive is missing $f — is this a scripts/backup.sh output?"
done

if [ -f .env ]; then
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  read -r -p "This overwrites the existing .env (saved as .env.bak-${STAMP} first). Continue? [y/N] " reply
  case "$reply" in [yY]*) ;; *) die "Aborted." ;; esac
  cp .env ".env.bak-${STAMP}"
fi
cp "$WORKDIR/env" .env
chmod 600 .env
log "Restored .env — double-check APP_DOMAIN/API_DOMAIN/etc. match THIS box before going live."

read_env() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }
POSTGRES_USER="$(read_env POSTGRES_USER)"
[ -n "$POSTGRES_USER" ] || die "POSTGRES_USER missing from the restored .env"

wait_for_pg() {
  for i in $(seq 1 30); do
    $COMPOSE exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

log "Starting Postgres"
$COMPOSE up -d postgres
wait_for_pg || die "Postgres never became ready."

log "Restoring Postgres (all databases + roles)"
# On a first-ever boot the official postgres image runs its init scripts
# against a TEMPORARY server, then restarts once for real — pg_isready can
# report ready during that temporary phase, right before the connection gets
# killed out from under a restore attempt. Retry rather than guess the exact
# timing: a couple of "already exists" errors from a prior partial attempt
# are harmless (each object is still only created/altered once that matters).
restored=0
for attempt in 1 2 3 4 5; do
  if $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
      < "$WORKDIR/postgres.sql" > "$WORKDIR/restore.log" 2>&1; then
    restored=1
    break
  fi
  warn "Restore attempt ${attempt}/5 lost its connection (Postgres likely still restarting internally) — retrying"
  sleep 5
  wait_for_pg || true
done
grep -v "already exists" "$WORKDIR/restore.log" >&2 || true
[ "$restored" -eq 1 ] || die "Postgres restore never completed — see output above."

# Redis/MinIO: seed their volumes BEFORE the process starts, rather than
# writing into a live one — `compose create` materializes the container +
# volume without starting it, so `docker cp` lands the data pre-boot.
# (minio-init just runs a one-shot bucket-setup script against minio's data —
# no volume of its own, so it doesn't need pre-seeding; it runs normally as
# part of the full `up -d` below.)
log "Seeding Redis + MinIO volumes"
$COMPOSE create redis minio

if [ -f "$WORKDIR/redis-dump.rdb" ]; then
  docker cp "$WORKDIR/redis-dump.rdb" "$($COMPOSE ps -a -q redis):/data/dump.rdb"
else
  warn "No redis-dump.rdb in the archive — starting Redis empty (cache/analytics only, not core data)."
fi

if [ -f "$WORKDIR/minio-data.tar.gz" ]; then
  mkdir "$WORKDIR/minio-data"
  tar xzf "$WORKDIR/minio-data.tar.gz" -C "$WORKDIR/minio-data"
  docker cp "$WORKDIR/minio-data/." "$($COMPOSE ps -a -q minio):/data"
else
  warn "No minio-data.tar.gz in the archive — starting MinIO empty. Uploaded media will be missing!"
fi

log "Bringing up the full stack"
$COMPOSE up -d

log "Done. Watch health with:"
echo "    $COMPOSE logs -f backend"
echo "  and confirm the app + existing data at your app's URL."
