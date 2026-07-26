#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — sync a dev machine to the current main.
#
#   bash scripts/dev-sync.sh              # pull, reconcile env, deps, DB
#   bash scripts/dev-sync.sh --seed       # ...and re-seed demo data
#   bash scripts/dev-sync.sh --no-pull    # skip git (already pulled)
#
# Written for working across more than one computer: whatever landed on the
# other machine (new migrations, new .env keys, new deps) gets applied here
# without hand-holding, and WITHOUT overwriting anything machine-specific.
#
# What it does, in order:
#   1. git pull (fast-forward only — never rewrites your local work)
#   2. Reconciles each .env against its tracked .env.example: keys that exist
#      in the example but not in your .env are APPENDED with the example's
#      value. Existing values are never touched, so a machine-specific
#      DATABASE_URL port, a custom secret, etc. all survive.
#   3. Reinstalls deps only when a package-lock.json actually changed
#   4. Brings up the dev infra containers and waits for Postgres
#   5. `prisma generate` + `prisma migrate deploy` — the generate matters as
#      much as the migrate: a stale client throws confusing "Unknown argument"
#      errors at runtime even though the schema and DB are both correct.
#
# Safe to re-run. Anything it rewrites is backed up as <file>.bak-<timestamp>.
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

log()  { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[!!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\n\033[31m==> %s\033[0m\n' "$*" >&2; exit 1; }

DO_PULL=1
DO_SEED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --seed)    DO_SEED=1; shift ;;
    --no-pull) DO_PULL=0; shift ;;
    -h|--help) sed -n '3,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# --- 1. Pull -----------------------------------------------------------------
if [ "$DO_PULL" = 1 ]; then
  log "Pulling latest main"
  if [ -n "$(git status --porcelain)" ]; then
    warn "You have uncommitted changes:"
    git status --short | sed 's/^/    /'
    read -r -p "Pull on top of these? Nothing is discarded, but the merge may fail. [y/N] " reply
    case "$reply" in [yY]*) ;; *) die "Aborted — commit or stash first." ;; esac
  fi
  # --ff-only so this can never create a surprise merge commit or rewrite
  # local history; if it refuses, that's real divergence worth looking at.
  git pull --ff-only || die "Can't fast-forward — you have local commits that aren't on origin. Rebase or merge by hand, then re-run."
  ok "At $(git rev-parse --short HEAD) ($(git log -1 --format=%s | cut -c1-60))"
else
  log "Skipping git pull (--no-pull)"
fi

# --- 2. Env reconciliation ---------------------------------------------------
# Append keys the example has and the local file doesn't. Deliberately additive
# only: this never edits or removes an existing line, because these files hold
# per-machine values (ports, secrets) that must not be clobbered by a sync.
sync_env() {
  local example="$1" target="$2" key line
  local added=()

  [ -f "$example" ] || return 0
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    ok "$target created from $(basename "$example") — review it before running anything."
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    grep -q "^${key}=" "$target" || added+=("$line")
  done < "$example"

  if [ "${#added[@]}" -eq 0 ]; then
    ok "$target already has every key from $(basename "$example")"
    return 0
  fi

  cp "$target" "${target}.bak-${STAMP}"
  {
    printf '\n# --- Added by scripts/dev-sync.sh (%s) — values copied from %s ---\n' \
      "$STAMP" "$(basename "$example")"
    printf '%s\n' "${added[@]}"
  } >> "$target"

  ok "$target — added ${#added[@]} new key(s):"
  printf '%s\n' "${added[@]}" | sed 's/^/      /'
}

log "Reconciling env files against their .env.example"
sync_env .env.example .env
sync_env apps/backend/.env.example apps/backend/.env
sync_env apps/frontend/.env.example apps/frontend/.env

# --- 3. Dependencies ---------------------------------------------------------
# npm writes node_modules/.package-lock.json on install, so a lockfile newer
# than that means the lockfile moved (someone else's install) and we're stale.
needs_install() {
  local dir="$1"
  [ -d "$dir/node_modules" ] || return 0
  [ -f "$dir/node_modules/.package-lock.json" ] || return 0
  [ "$dir/package-lock.json" -nt "$dir/node_modules/.package-lock.json" ]
}

for app in apps/backend apps/frontend; do
  if needs_install "$app"; then
    log "Installing deps in $app (lockfile changed)"
    # `npm ci` rather than `install`: it installs exactly the pulled lockfile
    # and can't quietly rewrite it into a spurious local diff.
    (cd "$app" && npm ci)
  else
    ok "$app deps already match its lockfile"
  fi
done

# --- 4. Dev infra ------------------------------------------------------------
DEV_COMPOSE=(-f docker-compose.dev.yml)
# Gitignored, per-machine port remaps etc. Picking it up automatically is the
# whole point — it's what lets two machines disagree about host ports.
if [ -f docker-compose.local.yml ]; then
  DEV_COMPOSE+=(-f docker-compose.local.yml)
  ok "Including docker-compose.local.yml (machine-specific overrides)"
fi

log "Starting dev infra (Postgres/Redis/MinIO/Adminer)"
docker compose "${DEV_COMPOSE[@]}" up -d

read_env() { [ -f .env ] && grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }
PG_USER="$(read_env POSTGRES_USER)"; PG_USER="${PG_USER:-izyah}"

log "Waiting for Postgres"
for i in $(seq 1 30); do
  if docker compose "${DEV_COMPOSE[@]}" exec -T postgres pg_isready -U "$PG_USER" >/dev/null 2>&1; then
    ok "Postgres ready after ${i} attempt(s)"
    break
  fi
  [ "$i" -lt 30 ] || die "Postgres never became ready — check: docker compose ${DEV_COMPOSE[*]} logs postgres"
  sleep 2
done

# --- 5. Prisma ---------------------------------------------------------------
log "Regenerating the Prisma client"
(cd apps/backend && npx prisma generate >/dev/null)
ok "Client matches schema.prisma"

log "Applying migrations"
MIGRATE_LOG="$(mktemp)"
trap 'rm -f "$MIGRATE_LOG"' EXIT
if (cd apps/backend && npx prisma migrate deploy) > "$MIGRATE_LOG" 2>&1; then
  cat "$MIGRATE_LOG"
else
  cat "$MIGRATE_LOG"
  # A machine that predates the switch to migrations has the right schema but
  # no _prisma_migrations table, and Prisma refuses to even try: P3005 is its
  # dedicated code for exactly that. Same self-healing baseline the container
  # entrypoint does (apps/backend/docker-entrypoint.sh) — mark the existing
  # schema as already-migrated instead of wiping the database, which is what
  # `migrate reset` would do. Any other failure is real and aborts.
  grep -q "P3005" "$MIGRATE_LOG" || die "Migrations failed for a reason other than an un-baselined database — see the output above."

  warn "This database predates the migration history (P3005) and needs baselining."
  warn "That runs 'prisma db push --accept-data-loss' to square the schema first,"
  warn "which CAN drop a column/table if your local DB drifted from schema.prisma."
  read -r -p "Baseline it? (Your rows are otherwise kept — this is not a reset.) [y/N] " reply
  case "$reply" in
    [yY]*) ;;
    *) die "Aborted. To wipe and rebuild instead — DESTROYS LOCAL DEV DATA:
      cd apps/backend && npx prisma migrate reset" ;;
  esac

  log "Baselining"
  (
    cd apps/backend
    npx prisma db push --skip-generate --accept-data-loss
    for dir in prisma/migrations/*/; do
      name="$(basename "$dir")"
      # P3008 = already marked applied by an earlier interrupted attempt.
      if ! npx prisma migrate resolve --applied "$name" > /tmp/resolve.log 2>&1; then
        cat /tmp/resolve.log
        grep -q "P3008" /tmp/resolve.log || exit 1
        ok "$name already marked applied"
      fi
    done
    npx prisma migrate deploy
  ) || die "Baselining failed — see the output above."
  ok "Baselined; migration history now tracked"
fi

if [ "$DO_SEED" = 1 ]; then
  log "Seeding demo data"
  (cd apps/backend && npm run db:seed)
fi

# --- Summary ----------------------------------------------------------------
cat <<EOF

$(printf '\033[32mIn sync.\033[0m')

  Commit    $(git rev-parse --short HEAD)
  Infra     docker compose ${DEV_COMPOSE[*]} ps
  Backups   any rewritten file is saved as <file>.bak-${STAMP}

Start developing:
  $(printf '\033[36mmake backend-dev\033[0m')    # API on :4000
  $(printf '\033[36mmake frontend-dev\033[0m')   # app on :5173

EOF
if [ "$DO_SEED" = 0 ]; then
  echo "  Re-run with --seed if you want the demo events/users back."
  echo
fi
