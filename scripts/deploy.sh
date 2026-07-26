#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — VPS deploy step (run BY the CI/CD workflow over SSH, from ~/izyah).
#
# Expects in the environment:
#   IMAGE_TAG      git SHA to deploy (tag pushed to GHCR by CI)
#   GHCR_USER      GHCR username for pulling private images
#   GHCR_TOKEN     PAT with read:packages
#   GITHUB_TOKEN   optional — auths `git fetch` against this (private) repo
#
# Flow: sync repo to the SHA -> preflight (env sanity + stale-container warning)
# -> pull images -> recreate backend+frontend -> poll the API health endpoint ->
# on failure, roll back to the last good SHA.
# ============================================================================
set -euo pipefail

: "${IMAGE_TAG:?IMAGE_TAG is required}"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml"
LAST_GOOD_FILE=".deployed_tag"
HEALTH_RETRIES=30       # 30 * 4s = up to 2 min for migrations + boot
HEALTH_DELAY=4

log()  { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m==> %s\033[0m\n' "$*" >&2; exit 1; }

# Read a KEY=value from the (gitignored) .env on the box.
read_env() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }

# Informational only: flag keys .env.example knows about that this box's
# .env has never declared — usually a feature added after the box's .env
# was set up (e.g. Web Push's VAPID_*). docker compose already treats an
# undeclared var as blank, so nothing breaks; this just stops that from
# happening silently. We never write to .env — .env.example mixes safe-blank
# optional keys with dev-only defaults (MINIO_ROOT_PASSWORD etc.) that must
# never be auto-copied into production.
warn_new_env_keys() {
  [ -f .env.example ] || return 0
  local key missing=()
  while IFS='=' read -r key _; do
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    grep -q "^${key}=" .env || missing+=("$key")
  done < .env.example
  if [ "${#missing[@]}" -gt 0 ]; then
    log "New in .env.example but not in .env (deploying with them blank/disabled):"
    printf '    %s\n' "${missing[@]}"
  fi
}

# Informational only: flag services whose RUNNING container was created from
# an older resolved spec than the compose files now describe. Those keep
# serving the stale spec indefinitely, because this script only ever recreates
# backend+frontend — nothing here touches traefik, adminer, minio...
#
# That is not hypothetical: a traefik container created before the base compose
# pinned v3.6.1 kept running v3.1, whose Docker client speaks API 1.24 and is
# refused by Engine 28+. Its provider dead-looped, zero routers were
# registered, every URL 404'd — and both the deploy AND its automatic rollback
# failed health-check, because the fault was the proxy, not either commit.
# Adminer had drifted the same way (still on the `web` entrypoint, so its HTTPS
# router did not exist). Neither was detectable from this script's output.
#
# Compose stamps the hash of each service's resolved config onto the container
# as com.docker.compose.config-hash, and `config --hash` recomputes it from the
# current files — so this is the very same comparison `up` uses to decide
# whether a container needs recreating, just without acting on it.
#
# Advisory, never fatal: upgrading the compose binary can legitimately change
# how every hash is computed, and that must not be able to block a deploy.
warn_stale_containers() {
  local service hash cid running drifted=()
  while read -r service hash; do
    [ -n "$service" ] || continue
    # These two are *expected* to differ — every deploy points them at a new
    # image tag, and deploy_tag recreates them a few lines from now.
    case "$service" in backend|frontend) continue ;; esac
    cid="$($COMPOSE ps -q "$service" 2>/dev/null | head -n1)"
    # Not running (or profile-gated): `up` creates it from the current spec.
    [ -n "$cid" ] || continue
    running="$(docker inspect "$cid" \
      --format '{{index .Config.Labels "com.docker.compose.config-hash"}}' 2>/dev/null || true)"
    [ "$running" = "$hash" ] || drifted+=("$service")
  done < <($COMPOSE config --hash '*' 2>/dev/null || true)

  [ "${#drifted[@]}" -gt 0 ] || return 0

  log "STALE CONTAINERS — running a spec older than the current compose files:"
  printf '    %s\n' "${drifted[@]}"
  printf '\n  Not deployed by this script, so they will stay stale. Recreate on the box:\n'
  printf '      cd %s && \\\n        %s up -d --force-recreate --no-deps %s\n\n' \
    "$(pwd)" "$COMPOSE" "${drifted[*]}"
}

# Preflight: catch config that would crash the backend at boot BEFORE we
# recreate containers, so it fails in 1s with a clear reason instead of a
# 2-minute health-timeout + rollback.
preflight() {
  [ -f .env ] || die ".env not found in $(pwd) — cannot deploy."
  warn_new_env_keys
  warn_stale_containers
  local node_env session
  node_env="$(read_env NODE_ENV)"
  session="$(read_env SESSION_SECRET)"
  if [ "$node_env" = "production" ]; then
    case "$session" in
      "")            die "SESSION_SECRET is missing from .env — set one: openssl rand -hex 32" ;;
      dev-insecure-*) die "SESSION_SECRET is still the insecure dev default — set a real one: openssl rand -hex 32" ;;
    esac
  fi
}

# API health URL, derived from the (gitignored) .env on the box.
API_DOMAIN="$(grep -E '^API_DOMAIN=' .env | cut -d= -f2-)"
HEALTH_URL="https://${API_DOMAIN}/health"

# Authenticate to GHCR so private images can be pulled.
if [ -n "${GHCR_TOKEN:-}" ]; then
  log "Logging in to GHCR as ${GHCR_USER:-?}"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

# Bring the working tree exactly to the deployed commit (compose files, scripts).
# .env and the generated docker-compose.prod.yml are gitignored, so they persist.
# The repo is private, so an anonymous fetch 401s — authenticate if a token was
# handed to us (the CI caller passes its own run token; a manual run against a
# public repo, or one where the box already has git credentials set up, works
# fine without it).
log "Syncing repo to ${IMAGE_TAG}"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git -c http.https://github.com/.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')" \
    fetch --all --prune --quiet
else
  git fetch --all --prune --quiet
fi
git checkout --force "$IMAGE_TAG"

PREV_TAG="$(cat "$LAST_GOOD_FILE" 2>/dev/null || true)"

deploy_tag() {
  local tag="$1"
  log "Deploying ${tag}"
  IMAGE_TAG="$tag" $COMPOSE pull backend frontend
  IMAGE_TAG="$tag" $COMPOSE up -d --no-build backend frontend
}

health_ok() {
  log "Health-checking ${HEALTH_URL}"
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      echo "  healthy after ${i} attempt(s)"
      return 0
    fi
    sleep "$HEALTH_DELAY"
  done
  return 1
}

preflight
deploy_tag "$IMAGE_TAG"

if health_ok; then
  echo "$IMAGE_TAG" > "$LAST_GOOD_FILE"
  log "Deploy OK: ${IMAGE_TAG}"
  docker image prune -f >/dev/null 2>&1 || true
else
  log "Health check FAILED for ${IMAGE_TAG}"
  if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$IMAGE_TAG" ]; then
    log "Rolling back to ${PREV_TAG}"
    git checkout --force "$PREV_TAG" || true
    deploy_tag "$PREV_TAG"
    health_ok && echo "  rollback healthy" || echo "  !! rollback also unhealthy — needs manual attention"
  else
    echo "  no previous good tag recorded — leaving as-is for inspection"
  fi
  exit 1
fi
