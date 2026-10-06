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
# Label the nip.io hostnames sit under: <label>.<dashed-ip>.nip.io.
NIP_LABEL="${NIP_LABEL:-izyah}"
MINIO_ROOT_USER_IN="${MINIO_ROOT_USER:-izyah-minio}"
POSTGRES_USER_IN="${POSTGRES_USER:-izyah}"
POSTGRES_DB_IN="${POSTGRES_DB:-izyah}"
START="ask"                   # ask | yes | no

usage() {
  cat <<EOF
Usage: ./setup.sh [mode] [options]

Modes (choose one; you'll be prompted if none is given):
  --domain <d>   Real domain, HTTPS via Let's Encrypt
  --nip          No domain: use <public-ip>.nip.io with HTTPS
  --http         No domain: use <public-ip>.nip.io over plain HTTP (no cert)

Options:
  --ip <addr>    Public IP to use with --nip/--http (default: auto-detect)
  --label <l>    Label the nip.io names sit under (default: izyah), giving
                 <label>.<dashed-ip>.nip.io and api./db./media. beneath it
  --email <e>    Optional. Caddy issues certs without an account email; this is
                 only kept for expiry warnings. Put it in Caddy's global options.
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
    --label)  NIP_LABEL="${2:?}"; shift 2 ;;
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
  # nip.io resolves <anything>.<ip>.nip.io to <ip>, with the IP written either
  # dotted or dashed. Dashed, and behind a label, for two reasons:
  #
  #   izyah.75-119-136-160.nip.io      <- this
  #   75.119.136.160.nip.io            <- what this used to produce
  #
  # The bare form takes the whole IP's nip.io namespace for one app, so a second
  # app on the same box has nowhere to go. The box already runs others under
  # ollama./n8n./timeline.<dashed-ip>.nip.io, so this matches them, and every
  # izyah hostname ends up under one label: api.izyah..., db.izyah..., media.izyah...
  IP_DASHED="$(printf '%s' "$IP_IN" | tr '.' '-')"
  BASE="${NIP_LABEL}.${IP_DASHED}.nip.io"
fi

# Caddy issues certificates without an account email, unlike the Traefik ACME
# resolver this replaced — so this is no longer prompted for or required. Set one
# only if you want expiry warnings from Let's Encrypt, in Caddy's global options:
#   { email you@example.com }   at the top of /etc/caddy/Caddyfile

# Derived hostnames.
APP_DOMAIN="$BASE"
API_DOMAIN="api.$BASE"
MEDIA_DOMAIN="media.$BASE"     # MinIO S3 endpoint (browser-facing object URLs)
DB_DOMAIN="db.$BASE"           # Adminer
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

# Adminer sits behind HTTP Basic Auth, now applied by Caddy rather than a Traefik
# middleware. ADMIN_AUTH_PASSWORD is kept alongside the hash only so a re-run can
# reuse it instead of silently rotating your login.
#
# The hash must be BCRYPT: Caddy's basic_auth does not accept the apr1 hash that
# `openssl passwd -apr1` produces, which is what this used to generate.
ADMIN_AUTH_USER="$(read_env ADMIN_AUTH_USER)"; [ -n "$ADMIN_AUTH_USER" ] || ADMIN_AUTH_USER="admin"
ADMIN_AUTH_PASSWORD="$(read_env ADMIN_AUTH_PASSWORD)"; [ -n "$ADMIN_AUTH_PASSWORD" ] || ADMIN_AUTH_PASSWORD="$(openssl rand -hex 16)"
hash_password() {
  if command -v caddy >/dev/null 2>&1; then
    caddy hash-password --plaintext "$1"
  elif command -v htpasswd >/dev/null 2>&1; then
    # -B is bcrypt; -n prints instead of writing a file. Strip the "user:" prefix.
    htpasswd -nbB x "$1" | cut -d: -f2-
  else
    return 1
  fi
}
if ADMIN_AUTH_BCRYPT="$(hash_password "$ADMIN_AUTH_PASSWORD")"; then
  :
else
  warn "Neither caddy nor htpasswd is available to hash the Adminer password."
  warn "  Set ADMIN_AUTH_BCRYPT in .env before running scripts/caddy-site.sh --install:"
  warn "    caddy hash-password --plaintext '<password>'"
  ADMIN_AUTH_BCRYPT=""
fi
# docker compose interpolates $VAR/${VAR} in .env files too (not just compose YAML),
# so a bare bcrypt hash's `$` segments get silently swallowed as references to
# undefined vars. Escape before writing to .env; scripts/caddy-site.sh undoubles it.
ADMIN_AUTH_BCRYPT_ESCAPED="${ADMIN_AUTH_BCRYPT//\$/\$\$}"

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

# --- Domains (Caddy site addresses) ----------------------------------------
APP_DOMAIN=$APP_DOMAIN
API_DOMAIN=$API_DOMAIN
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
# is terminated by the Caddy on the host, so MINIO_USE_SSL stays false here.
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

# --- Admin surfaces (Adminer) -----------------------------------------------
# HTTP Basic Auth in front of Adminer, applied by Caddy — see the summary this
# script prints for the plaintext password (only ever shown once per rotation).
ADMIN_AUTH_USER=$ADMIN_AUTH_USER
ADMIN_AUTH_PASSWORD=$ADMIN_AUTH_PASSWORD
ADMIN_AUTH_BCRYPT=$ADMIN_AUTH_BCRYPT_ESCAPED

# --- Host ports for the reverse proxy ---------------------------------------
# Caddy runs on the host, outside docker, so it reaches each service through a
# published port rather than the compose network. 127.0.0.1 is what makes the
# proxy the only way in.
HOST_BIND=127.0.0.1
FRONTEND_HOST_PORT=4310
BACKEND_HOST_PORT=4311
ADMINER_HOST_PORT=4312
MINIO_HOST_PORT=4313
MINIO_CONSOLE_HOST_PORT=4314
AUTH_HOST_PORT=4315
AUTH_ADMIN_HOST_PORT=4316

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

# --- 3. Reverse proxy -------------------------------------------------------
# Nothing to generate here any more. Traefik used to be written out as an
# overlay plus a generated static config, and it bound 80/443 itself — which is
# precisely why it had to go: nothing else on the box could have those ports.
# TLS, ACME and routing now belong to the Caddy running on the host, shared with
# every other app there. This stack only publishes each service on ${HOST_BIND},
# and scripts/caddy-site.sh renders the site blocks from the .env written above.
COMPOSE_ARGS=(-f docker-compose.yml)
if [ "$TLS" = 1 ]; then
  if command -v caddy >/dev/null 2>&1; then
    ok "caddy found on this host."
  else
    warn "caddy is NOT installed on this host, so nothing will answer for $APP_DOMAIN."
    warn "  Install it: https://caddyserver.com/docs/install#debian-ubuntu-raspbian"
  fi
  info "Routing is a separate step, once the stack is up:"
  info "  sudo ./scripts/caddy-site.sh --install"
else
  warn "HTTP mode: no TLS. Traffic is UNENCRYPTED — testing only."
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

  None of those answer until the Caddy on this host has the site blocks:
  ${c_cyn}sudo ./scripts/caddy-site.sh --install${c_0}

  Secrets live in ./.env (chmod 600), already gitignored.

Manage the stack:
  ${c_cyn}$run_cmd up -d --build${c_0}
  $run_cmd logs -f backend
  $run_cmd down
  journalctl -u caddy -f        # routing and certificates (the proxy is not in this stack)

Notes:
EOF
if [ "$TLS" = 1 ]; then
  cat <<EOF
  - First cert needs ports 80/443 reachable and the hosts above resolving to
    this VPS. Caddy issues them; watch 'journalctl -u caddy -f' for ACME activity.
  - Only 80/443 should be open. The 4310-4316 range is bound to 127.0.0.1 for
    Caddy to reach, and opening it would serve the app in plain http alongside
    the TLS you just set up.
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
  - Adminer requires HTTP Basic Auth (enforced by Caddy):
      user:     $ADMIN_AUTH_USER
      password: $ADMIN_AUTH_PASSWORD
    (also saved in .env as ADMIN_AUTH_USER/ADMIN_AUTH_PASSWORD — a re-run
    reuses rather than rotates it, same as the other secrets above.)
EOF
