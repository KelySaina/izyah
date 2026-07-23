#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — VPS deploy step (run BY the CI/CD workflow over SSH, from ~/izyah).
#
# Expects in the environment:
#   IMAGE_TAG   git SHA to deploy (tag pushed to GHCR by CI)
#   GHCR_USER   GHCR username for pulling private images
#   GHCR_TOKEN  PAT with read:packages
#
# Flow: sync repo to the SHA -> pull images -> recreate backend+frontend ->
# poll the API health endpoint -> on failure, roll back to the last good SHA.
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

# Preflight: catch config that would crash the backend at boot BEFORE we
# recreate containers, so it fails in 1s with a clear reason instead of a
# 2-minute health-timeout + rollback.
preflight() {
  [ -f .env ] || die ".env not found in $(pwd) — cannot deploy."
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
log "Syncing repo to ${IMAGE_TAG}"
git fetch --all --prune --quiet
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
