#!/bin/sh
# Sync the schema to the database, optionally seed, then hand off to CMD.
set -e

echo "==> Applying database schema"
# Prefer committed migrations; fall back to db push for a fresh scaffold that
# has none yet. --accept-data-loss is required here since this project has no
# migration history to diff against — db push otherwise hard-fails (not just
# warns) on any change that adds a unique/required constraint, e.g. a new
# @unique column that's NULL on existing rows (safe: Postgres allows multiple
# NULLs in a unique column, but Prisma warns regardless of actual risk).
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate --accept-data-loss
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "==> Seeding database (idempotent)"
  npx tsx prisma/seed.ts || echo "!! seed failed (continuing)"
fi

echo "==> Starting: $*"
exec "$@"
