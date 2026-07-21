#!/bin/sh
# Sync the schema to the database, optionally seed, then hand off to CMD.
set -e

echo "==> Applying database schema"
# Prefer committed migrations; fall back to db push for a fresh scaffold that
# has none yet. Both are safe against an empty database.
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "==> Seeding database (idempotent)"
  npx tsx prisma/seed.ts || echo "!! seed failed (continuing)"
fi

echo "==> Starting: $*"
exec "$@"
