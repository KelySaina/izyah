#!/bin/sh
# Sync the schema to the database, optionally seed, then hand off to CMD.
set -e

echo "==> Applying database schema"
# Prefer committed migrations (reviewable SQL, no blind --accept-data-loss on
# every deploy). Fall back to db push only for a fresh scaffold with no
# migration history at all.
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  if npx prisma migrate deploy > /tmp/migrate.log 2>&1; then
    cat /tmp/migrate.log
  else
    cat /tmp/migrate.log
    # This project ran on `db push` (no migration history) until this change.
    # An existing database (prod, or any env not yet baselined) already has
    # this schema, and Prisma refuses to even attempt migrate deploy against
    # it — P3005 "the database schema is not empty" is its own dedicated,
    # stable error code for exactly this case (confirmed against a real
    # simulated pre-migration DB, not guessed from generic SQL error text).
    # A real connection/credentials/syntax failure won't match and falls
    # through to `exit 1` below instead of being silently treated as safe.
    if grep -q "P3005" /tmp/migrate.log; then
      echo "==> Existing pre-migration database detected — baselining"
      # Bring the schema fully current first (regardless of whether the DB
      # was left mid-way by an earlier failed deploy), THEN record every
      # migration as already applied, so this only ever happens once.
      npx prisma db push --skip-generate --accept-data-loss
      for dir in prisma/migrations/*/; do
        name="$(basename "$dir")"
        # Tolerate a crash-and-restart mid-baseline: P3008 just means this
        # specific migration was already resolved on a prior attempt.
        # Anything else is a real failure and should still abort the boot.
        if ! npx prisma migrate resolve --applied "$name" > /tmp/resolve.log 2>&1; then
          cat /tmp/resolve.log
          grep -q "P3008" /tmp/resolve.log || exit 1
          echo "==> $name already marked applied, continuing"
        fi
      done
      npx prisma migrate deploy
    else
      exit 1
    fi
  fi
else
  npx prisma db push --skip-generate --accept-data-loss
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "==> Seeding database (idempotent)"
  npx tsx prisma/seed.ts || echo "!! seed failed (continuing)"
fi

echo "==> Starting: $*"
exec "$@"
