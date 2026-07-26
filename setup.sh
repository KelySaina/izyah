#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — one-shot VPS provisioning.
#
# Pick how the stack is reached from the internet:
#
#   With a real domain (HTTPS via Let's Encrypt):
#     ./setup.sh --domain izyah.example.com --email you@example.com
#
#   No domain, just a public IP — free HTTPS via nip.io wildcard DNS:
#     ./setup.sh --nip --email you@example.com          # auto-detects the IP
#     ./setup.sh --nip --ip 203.0.113.10 --email you@example.com
#
#   No domain, plain HTTP on the IP (nip.io hostnames, NO cert — testing only):
#     ./setup.sh --http                                 # auto-detects the IP
#
# Run with no flags to be prompted. Each step is idempotent.
#
# Why nip.io: a bare IP can't get a public TLS cert and can't carry the
# api./media./db. subdomains this stack routes by. "<ip>.nip.io" and
# "api.<ip>.nip.io" are real DNS names that resolve to your IP, so both work.
#
# Run as a user with sudo (or as root) from inside the repo.
# ============================================================================
set -euo pipefail

# --- Locate the repo (this script's directory) ------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# --- Pretty logging ---------------------------------------------------------
c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_red=$'\033[31m'; c_cyn=$'\033[36m'; c_0=$'\033[0m'
info()  { printf '%s==>%s %s\n'  "$c_cyn" "$c_0" "$*"; }
ok()    { printf '%s[ok]%s %s\n' "$c_grn" "$c_0" "$*"; }
warn()  { printf '%s[!!]%s %s\n' "$c_ylw" "$c_0" "$*" >&2; }
die()   { printf '%s[xx]%s %s\n' "$c_red" "$c_0" "$*" >&2; exit 1; }

# --- sudo helper (empty when already root) ----------------------------------
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "Run as root or install sudo."
  SUDO="sudo"
fi

# --- Args -------------------------------------------------------------------
DOMAIN="${DOMAIN:-}"          # real domain (HTTPS)
USE_NIP=0                     # --nip : <ip>.nip.io + HTTPS
USE_HTTP=0                    # --http: <ip>.nip.io + plain HTTP, no cert
IP_IN="${IP:-}"              # override auto-detected public IP
ACME_EMAIL="${ACME_EMAIL:-}"
MINIO_ROOT_USER_IN="${MINIO_ROOT_USER:-izyah-minio}"
POSTGRES_USER_IN="${POSTGRES_USER:-izyah}"
POSTGRES_DB_IN="${POSTGRES_DB:-izyah}"
START="ask"                   # ask | yes | no

usage() {
  cat <<EOF
Usage: ./setup.sh [mode] [options]

Modes (choose one; you'll be prompted if none is given):
  --domain <d>   Real domain, HTTPS via Let's Encrypt (needs --email)
  --nip          No domain: use <public-ip>.nip.io with HTTPS (needs --email)
  --http         No domain: use <public-ip>.nip.io over plain HTTP (no cert)

Options:
  --ip <addr>    Public IP to use with --nip/--http (default: auto-detect)
  --email <e>    Let's Encrypt email (required for HTTPS modes)
  --start        Build and start without asking
  --no-start     Configure only
  -h, --help     This help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --nip)    USE_NIP=1; shift ;;
    --http)   USE_HTTP=1; shift ;;
    --ip)     IP_IN="${2:?}"; shift 2 ;;
    --email)  ACME_EMAIL="${2:?}"; shift 2 ;;
    --start)    START="yes"; shift ;;
    --no-start) START="no";  shift ;;
    -h|--help)  usage; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

# --- Public IP detection ----------------------------------------------------
detect_ip() {
  local ip u
  command -v curl >/dev/null 2>&1 || { $SUDO apt-get update -y && $SUDO apt-get install -y curl; }
  for u in https://api.ipify.org https://ifconfig.me https://icanhazip.com; do
    ip="$(curl -fsS --max-time 5 "$u" 2>/dev/null | tr -d '[:space:]')" || true
    if printf '%s' "$ip" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
      printf '%s' "$ip"; return 0
    fi
  done
  return 1
}

# --- Resolve mode (prompt if nothing chosen) --------------------------------
# MODE = domain | nip | http ; TLS = 1/0 ; SCHEME = https/http
if [ -n "$DOMAIN" ]; then
  MODE="domain"
elif [ "$USE_NIP" = 1 ]; then
  MODE="nip"
elif [ "$USE_HTTP" = 1 ]; then
  MODE="http"
else
  [ -t 0 ] || die "No mode given and not interactive (use --domain / --nip / --http)."
  echo "How will this VPS be reached?"
  echo "  1) I have a domain              -> HTTPS (recommended)"
  echo "  2) No domain, use <ip>.nip.io   -> free HTTPS (recommended if no domain)"
  echo "  3) No domain, plain HTTP on IP  -> no cert, testing only"
  read -rp "Choice [1/2/3]: " choice
  case "$choice" in
    1) MODE="domain"; read -rp "Domain (e.g. izyah.example.com): " DOMAIN ;;
    2) MODE="nip" ;;
    3) MODE="http" ;;
    *) die "Invalid choice." ;;
  esac
fi

case "$MODE" in
  domain) TLS=1; SCHEME="https"; [ -n "$DOMAIN" ] || die "Domain required." ; BASE="$DOMAIN" ;;
  nip)    TLS=1; SCHEME="https" ;;
  http)   TLS=0; SCHEME="http"  ;;
esac

# For nip/http modes, resolve the IP and build the base hostname.
if [ "$MODE" = "nip" ] || [ "$MODE" = "http" ]; then
  if [ -z "$IP_IN" ]; then
    info "Detecting public IP..."
    IP_IN="$(detect_ip)" || die "Could not auto-detect public IP — pass --ip <addr>."
    ok "Public IP: $IP_IN"
  fi
  printf '%s' "$IP_IN" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || die "Invalid IP: $IP_IN"
  BASE="${IP_IN}.nip.io"
fi

# Email is only needed when issuing certs.
if [ "$TLS" = 1 ] && [ -z "$ACME_EMAIL" ]; then
  [ -t 0 ] || die "HTTPS mode needs --email."
  read -rp "Let's Encrypt email: " ACME_EMAIL
  [ -n "$ACME_EMAIL" ] || die "Email is required for HTTPS."
fi

# Derived hostnames.
APP_DOMAIN="$BASE"
API_DOMAIN="api.$BASE"
MEDIA_DOMAIN="media.$BASE"     # MinIO S3 endpoint (browser-facing object URLs)
DB_DOMAIN="db.$BASE"           # Adminer
TRAEFIK_DOMAIN="traefik.$BASE" # Traefik dashboard
AUTH_DOMAIN="auth.$BASE"             # Logto OIDC endpoint (M2 account-linking)
AUTH_ADMIN_DOMAIN="auth-admin.$BASE" # Logto admin console (M2)

info "Mode: $MODE  ·  scheme: $SCHEME  ·  app host: $APP_DOMAIN"

# --- 1. Docker --------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker + compose plugin already present."
    return
  fi
  info "Installing Docker (get.docker.com convenience script)..."
  command -v curl >/dev/null 2>&1 || { $SUDO apt-get update -y && $SUDO apt-get install -y curl; }
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker
  if [ -n "$SUDO" ] && id -nG "$USER" | grep -qvw docker; then
    $SUDO usermod -aG docker "$USER"
    warn "Added $USER to the 'docker' group — log out/in for it to take effect."
    warn "This run will keep using sudo for docker commands."
  fi
  ok "Docker installed."
}
install_docker

DC="docker"
$DC ps >/dev/null 2>&1 || DC="$SUDO docker"

# --- 2. Secrets + production .env -------------------------------------------
command -v openssl >/dev/null 2>&1 || { $SUDO apt-get update -y && $SUDO apt-get install -y openssl; }
gen() { openssl rand -hex 24; }   # 48 hex chars: URL/env-safe, no escaping needed

# Read a KEY=value from the current .env (empty if absent/blank). Used to REUSE
# existing secrets on a re-run instead of rotating them.
read_env() { [ -f .env ] && grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }

if [ -f .env ]; then
  bak=".env.bak-$(date +%Y%m%d%H%M%S)"
  cp .env "$bak"
  warn "Existing .env backed up to $bak. Existing secrets are REUSED (not rotated)."
  warn "  To force-rotate everything, delete .env first — but that breaks the existing"
  warn "  Postgres/MinIO volumes (password baked at init). Reprovision with 'down -v'."
fi

# Reuse existing secrets when present so re-running setup.sh on a LIVE box does
# not rotate credentials — rotating POSTGRES_PASSWORD against an existing volume
# breaks DB auth (the password is baked at first init). Only mint what's missing.
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"; [ -n "$POSTGRES_PASSWORD" ] || POSTGRES_PASSWORD="$(gen)"
MINIO_ROOT_PASSWORD="$(read_env MINIO_ROOT_PASSWORD)"; [ -n "$MINIO_ROOT_PASSWORD" ] || MINIO_ROOT_PASSWORD="$(gen)"
SESSION_SECRET="$(read_env SESSION_SECRET)"; [ -n "$SESSION_SECRET" ] || SESSION_SECRET="$(openssl rand -hex 32)"

# Adminer and the Traefik dashboard sit behind HTTP Basic Auth (Traefik
# middleware, base docker-compose.yml) — ADMIN_AUTH_HTPASSWD is the derived
# hash Traefik actually reads; ADMIN_AUTH_PASSWORD is kept alongside it only
# so a re-run can reuse it instead of silently rotating your login.
ADMIN_AUTH_USER="$(read_env ADMIN_AUTH_USER)"; [ -n "$ADMIN_AUTH_USER" ] || ADMIN_AUTH_USER="admin"
ADMIN_AUTH_PASSWORD="$(read_env ADMIN_AUTH_PASSWORD)"; [ -n "$ADMIN_AUTH_PASSWORD" ] || ADMIN_AUTH_PASSWORD="$(openssl rand -hex 16)"
ADMIN_AUTH_HTPASSWD="${ADMIN_AUTH_USER}:$(openssl passwd -apr1 -salt "$(openssl rand -hex 4)" "$ADMIN_AUTH_PASSWORD")"
# docker compose interpolates $VAR/${VAR} in .env files too (not just compose
# YAML) — a bare apr1 hash's `$` segments get silently swallowed as
# references to undefined vars otherwise. Escape before writing to .env; the
# unescaped $ADMIN_AUTH_HTPASSWD is only for the printed summary below.
ADMIN_AUTH_HTPASSWD_ESCAPED="${ADMIN_AUTH_HTPASSWD//\$/\$\$}"

# Preserve any Logto/OIDC config already wired in (so a re-run doesn't blank it).
OIDC_ISSUER="$(read_env OIDC_ISSUER)"
OIDC_AUDIENCE="$(read_env OIDC_AUDIENCE)"
OIDC_CLIENT_ID="$(read_env OIDC_CLIENT_ID)"

info "Writing production .env ..."
cat > .env <<EOF
# ============================================================================
# Izy'Ah — PRODUCTION environment (generated by setup.sh — do not commit).
# Mode: $MODE  ·  scheme: $SCHEME
# ============================================================================

# --- Domains (Traefik host rules) ------------------------------------------
APP_DOMAIN=$APP_DOMAIN
API_DOMAIN=$API_DOMAIN
TRAEFIK_DOMAIN=$TRAEFIK_DOMAIN
MINIO_CONSOLE_DOMAIN=$MEDIA_DOMAIN
ADMINER_DOMAIN=$DB_DOMAIN
AUTH_DOMAIN=$AUTH_DOMAIN
AUTH_ADMIN_DOMAIN=$AUTH_ADMIN_DOMAIN

# Browser-side URLs (baked into the frontend build).
VITE_API_URL=$SCHEME://$API_DOMAIN
VITE_SOCKET_URL=$SCHEME://$API_DOMAIN

# --- PostgreSQL -------------------------------------------------------------
POSTGRES_USER=$POSTGRES_USER_IN
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB_IN
DATABASE_URL=postgresql://$POSTGRES_USER_IN:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB_IN?schema=public

# --- Redis ------------------------------------------------------------------
REDIS_URL=redis://redis:6379

# --- MinIO / S3 -------------------------------------------------------------
# Backend reaches MinIO in-cluster over plain http (minio:9000); TLS (when on)
# is terminated by Traefik in front, so MINIO_USE_SSL stays false here.
MINIO_ROOT_USER=$MINIO_ROOT_USER_IN
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET_MEDIA=izyah-media
MINIO_BUCKET_AVATARS=izyah-avatars
# Public base browsers use to fetch objects.
MINIO_PUBLIC_URL=$SCHEME://$MEDIA_DOMAIN

# --- Backend ----------------------------------------------------------------
NODE_ENV=production
BACKEND_PORT=4000
CORS_ORIGINS=$SCHEME://$APP_DOMAIN
SEED_ON_START=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
LOG_LEVEL=info

# --- Auth / identity --------------------------------------------------------
# HMAC key for anonymous session tokens. Required — the backend refuses to boot
# in production with the insecure dev default. Reused across re-runs; only
# minted if absent from a prior .env.
SESSION_SECRET=$SESSION_SECRET
# Public URL of the app (used to build OIDC redirect/callback links in M2).
APP_URL=$SCHEME://$APP_DOMAIN

# --- Admin surfaces (Adminer, Traefik dashboard) ----------------------------
# HTTP Basic Auth in front of both — see the summary this script prints for
# the plaintext password (it's only ever shown once per rotation).
ADMIN_AUTH_USER=$ADMIN_AUTH_USER
ADMIN_AUTH_PASSWORD=$ADMIN_AUTH_PASSWORD
ADMIN_AUTH_HTPASSWD=$ADMIN_AUTH_HTPASSWD_ESCAPED

# --- OIDC (Logto) — empty = anonymous-only. Fill after provisioning ---------
# See SETUP-AUTH.md. OIDC_ISSUER e.g. $SCHEME://$AUTH_DOMAIN/oidc
OIDC_ISSUER=$OIDC_ISSUER
OIDC_AUDIENCE=$OIDC_AUDIENCE
OIDC_CLIENT_ID=$OIDC_CLIENT_ID

# --- Analytics --------------------------------------------------------------
ANALYTICS_ENABLED=true
EOF
chmod 600 .env
ok "Wrote .env (chmod 600). Postgres + MinIO passwords generated."

# --- 3. Overlay (only for HTTPS modes) --------------------------------------
COMPOSE_ARGS=(-f docker-compose.yml)
if [ "$TLS" = 1 ]; then
  COMPOSE_ARGS+=(-f docker-compose.prod.yml)
  info "Writing infra/traefik/traefik.prod.yml (Let's Encrypt) ..."
  mkdir -p infra/traefik letsencrypt
  cat > infra/traefik/traefik.prod.yml <<EOF
# Traefik v3 static config — PRODUCTION HTTPS (generated by setup.sh).
global:
  checkNewVersion: false
  sendAnonymousUsage: false
api:
  dashboard: true
  insecure: false
log:
  level: INFO
accessLog: {}
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
providers:
  docker:
    exposedByDefault: false
    network: izyah
    watch: true
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true
certificatesResolvers:
  letsencrypt:
    acme:
      email: $ACME_EMAIL
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
EOF
  ok "Wrote traefik.prod.yml (ACME email: $ACME_EMAIL)."

  info "Writing docker-compose.prod.yml overlay ..."
  # Quoted heredoc — ${VAR} stay literal so compose expands them from .env.
  cat > docker-compose.prod.yml <<'EOF'
# ============================================================================
# Izy'Ah — HTTPS production overlay. Layer on top of the base compose:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# Flips each router to websecure (443) with a Let's Encrypt cert; base files
# are left untouched.
# ============================================================================
services:
  traefik:
    # v3.6.1+ negotiates the Docker API version; earlier tags pin 1.24 and
    # break against Docker Engine 28+ ("client version 1.24 is too old").
    image: traefik:v3.6.1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./infra/traefik/traefik.prod.yml:/etc/traefik/traefik.yml:ro
      - ./infra/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
      - ./letsencrypt:/letsencrypt
    labels:
      - traefik.enable=true
      - traefik.http.routers.dashboard.entrypoints=websecure
      - traefik.http.routers.dashboard.tls.certresolver=letsencrypt

  backend:
    labels:
      - traefik.http.routers.backend.entrypoints=websecure
      - traefik.http.routers.backend.tls.certresolver=letsencrypt
      - traefik.http.routers.backend.middlewares=security-headers@file,compress@file

  frontend:
    labels:
      - traefik.http.routers.frontend.entrypoints=websecure
      - traefik.http.routers.frontend.tls.certresolver=letsencrypt
      - traefik.http.routers.frontend.middlewares=security-headers@file,compress@file

  minio:
    labels:
      - traefik.http.routers.minio.entrypoints=websecure
      - traefik.http.routers.minio.tls.certresolver=letsencrypt

  adminer:
    labels:
      - traefik.http.routers.adminer.entrypoints=websecure
      - traefik.http.routers.adminer.tls.certresolver=letsencrypt
EOF
  ok "Wrote docker-compose.prod.yml."
else
  warn "HTTP mode: no TLS overlay written. Traffic is UNENCRYPTED — testing only."
fi

# --- Firewall (best effort) -------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
  info "Opening ports in ufw ..."
  $SUDO ufw allow 80/tcp  >/dev/null 2>&1 || true
  [ "$TLS" = 1 ] && $SUDO ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "ufw rules ensured."
else
  [ "$TLS" = 1 ] && ports="80 and 443" || ports="80"
  warn "ufw not found — ensure the VPS firewall allows inbound $ports."
fi

# --- DNS sanity check (soft) ------------------------------------------------
for h in "$APP_DOMAIN" "$API_DOMAIN" "$MEDIA_DOMAIN"; do
  if ! getent hosts "$h" >/dev/null 2>&1; then
    warn "DNS: $h does not resolve yet."
    [ "$MODE" = "domain" ] && warn "  -> point an A record at this VPS."
    [ "$MODE" != "domain" ] && warn "  -> nip.io should resolve automatically; check outbound DNS."
  fi
done

# --- 4. Start ---------------------------------------------------------------
if [ "$START" = "ask" ]; then
  if [ -t 0 ]; then
    read -rp "Build and start the stack now? [Y/n] " ans
    case "${ans:-Y}" in [Nn]*) START="no" ;; *) START="yes" ;; esac
  else
    START="no"
  fi
fi

if [ "$START" = "yes" ]; then
  info "Building and starting the stack ..."
  $DC compose "${COMPOSE_ARGS[@]}" up -d --build
  ok "Stack is up."
  $DC compose "${COMPOSE_ARGS[@]}" ps || true
fi

# --- Summary ----------------------------------------------------------------
run_cmd="docker compose ${COMPOSE_ARGS[*]}"
cat <<EOF

${c_grn}Done.${c_0}

  App        $SCHEME://$APP_DOMAIN
  API        $SCHEME://$API_DOMAIN
  MinIO (S3) $SCHEME://$MEDIA_DOMAIN
  Adminer    $SCHEME://$DB_DOMAIN
  Traefik    $SCHEME://$TRAEFIK_DOMAIN

  Secrets live in ./.env (chmod 600), already gitignored.

Manage the stack:
  ${c_cyn}$run_cmd up -d --build${c_0}
  $run_cmd logs -f traefik
  $run_cmd down

Notes:
EOF
if [ "$TLS" = 1 ]; then
  cat <<EOF
  - First cert needs ports 80/443 reachable and the hosts above resolving to
    this VPS. Watch '$run_cmd logs -f traefik' for ACME activity.
  - nip.io is a shared domain; if Let's Encrypt rate-limits it, retry later
    or switch to a real domain (--domain).
EOF
else
  cat <<EOF
  - HTTP only: no encryption, browsers show "not secure", secure cookies and
    some PWA/Socket.IO features won't behave like production. Move to --nip
    (free HTTPS) or --domain before real use.
EOF
fi
cat <<EOF
  - Adminer and the Traefik dashboard require HTTP Basic Auth:
      user:     $ADMIN_AUTH_USER
      password: $ADMIN_AUTH_PASSWORD
    (also saved in .env as ADMIN_AUTH_USER/ADMIN_AUTH_PASSWORD — a re-run
    reuses rather than rotates it, same as the other secrets above.)
EOF
