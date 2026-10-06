#!/usr/bin/env bash
# ============================================================================
# Izy'Ah — render infra/caddy/izyah.caddyfile from .env and install it into the
# host's Caddy. Replaces the Traefik this stack used to ship: that bound 80/443
# itself, so nothing else on the box could have them.
#
#   ./scripts/caddy-site.sh                  print the rendered blocks, write nothing
#   sudo ./scripts/caddy-site.sh --install   install, validate, reload
#   sudo ./scripts/caddy-site.sh --install --with-auth
#                                            also install the Logto (OIDC) blocks
#
# Caddy is handed a rendered file of literal values, never this project's .env:
# a process that needs hostnames and ports has no business holding the database
# password, the MinIO root credentials and the VAPID private key.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SITE_DIR="/etc/caddy/sites"
MAIN_CADDYFILE="/etc/caddy/Caddyfile"
IMPORT_LINE="import $SITE_DIR/*.caddyfile"
DO_INSTALL=0
WITH_AUTH=0

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; OFF=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; YEL=""; GRN=""; OFF=""
fi
say()  { printf '%s\n' "$*" >&2; }
step() { printf '\n%s==>%s %s\n' "$BOLD" "$OFF" "$*" >&2; }
ok()   { printf '  %s✓%s %s\n' "$GRN" "$OFF" "$*" >&2; }
warn() { printf '  %s!%s %s\n' "$YEL" "$OFF" "$*" >&2; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --install) DO_INSTALL=1; shift ;;
    --with-auth) WITH_AUTH=1; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

[ -f .env ] || die ".env not found in $ROOT — run ./setup.sh first."
[ -f infra/caddy/izyah.caddyfile ] || die "infra/caddy/izyah.caddyfile is missing — run this from a complete checkout."

# `.env` doubles every literal `$` so docker compose does not interpolate it
# (see ADMIN_AUTH_* there). Caddy wants the real thing, so undo it on the way out.
read_env() { sed -n "s/^$1=//p" .env | tail -n1 | sed 's/\$\$/$/g'; }

APP_DOMAIN="$(read_env APP_DOMAIN)"
API_DOMAIN="$(read_env API_DOMAIN)"
MINIO_CONSOLE_DOMAIN="$(read_env MINIO_CONSOLE_DOMAIN)"
ADMINER_DOMAIN="$(read_env ADMINER_DOMAIN)"
AUTH_DOMAIN="$(read_env AUTH_DOMAIN)"
AUTH_ADMIN_DOMAIN="$(read_env AUTH_ADMIN_DOMAIN)"
ADMIN_AUTH_USER="$(read_env ADMIN_AUTH_USER)"
ADMIN_AUTH_BCRYPT="$(read_env ADMIN_AUTH_BCRYPT)"
HOST_BIND="$(read_env HOST_BIND)"

FRONTEND_HOST_PORT="$(read_env FRONTEND_HOST_PORT)"; : "${FRONTEND_HOST_PORT:=4310}"
BACKEND_HOST_PORT="$(read_env BACKEND_HOST_PORT)";   : "${BACKEND_HOST_PORT:=4311}"
ADMINER_HOST_PORT="$(read_env ADMINER_HOST_PORT)";   : "${ADMINER_HOST_PORT:=4312}"
MINIO_HOST_PORT="$(read_env MINIO_HOST_PORT)";       : "${MINIO_HOST_PORT:=4313}"
AUTH_HOST_PORT="$(read_env AUTH_HOST_PORT)";         : "${AUTH_HOST_PORT:=4315}"
AUTH_ADMIN_HOST_PORT="$(read_env AUTH_ADMIN_HOST_PORT)"; : "${AUTH_ADMIN_HOST_PORT:=4316}"

for v in APP_DOMAIN API_DOMAIN MINIO_CONSOLE_DOMAIN ADMINER_DOMAIN; do
  [ -n "${!v}" ] || die "$v is empty in .env — Caddy would have no hostname to answer for."
done

# The apr1 hash Traefik used is not accepted by Caddy's basic_auth, which takes
# bcrypt only. Say so here rather than let it fail at reload with a parse error.
if [ -z "$ADMIN_AUTH_BCRYPT" ] || [ -z "$ADMIN_AUTH_USER" ]; then
  die "ADMIN_AUTH_USER / ADMIN_AUTH_BCRYPT are not set in .env, and ${ADMINER_DOMAIN}
       exposes Adminer straight onto the production database. Mint a bcrypt hash:

         caddy hash-password --plaintext '<password>'

       then put it in .env, doubling every \$ so compose leaves it alone:
         ADMIN_AUTH_USER=admin
         ADMIN_AUTH_BCRYPT=\$\$2a\$\$14\$\$...."
fi
case "$ADMIN_AUTH_BCRYPT" in
  '$2a$'*|'$2b$'*|'$2y$'*) ;;
  '$apr1$'*) die "ADMIN_AUTH_BCRYPT holds an apr1 hash (openssl passwd -apr1), which Traefik
       accepted and Caddy does not. Re-mint it:  caddy hash-password --plaintext '<password>'" ;;
  *) die "ADMIN_AUTH_BCRYPT does not look like a bcrypt hash (expected \$2a\$/\$2b\$/\$2y\$)." ;;
esac

if [ -n "$HOST_BIND" ] && [ "$HOST_BIND" != "127.0.0.1" ]; then
  warn "HOST_BIND is '$HOST_BIND', not 127.0.0.1 — every service is published on all"
  warn "  interfaces, so they answer in plain http around Caddy. Fix it in .env and"
  warn "  re-run 'docker compose up -d'."
fi

render() { # render <template>
  sed -e "s|{\$APP_DOMAIN}|$APP_DOMAIN|g" \
      -e "s|{\$API_DOMAIN}|$API_DOMAIN|g" \
      -e "s|{\$MINIO_CONSOLE_DOMAIN}|$MINIO_CONSOLE_DOMAIN|g" \
      -e "s|{\$ADMINER_DOMAIN}|$ADMINER_DOMAIN|g" \
      -e "s|{\$AUTH_DOMAIN}|$AUTH_DOMAIN|g" \
      -e "s|{\$AUTH_ADMIN_DOMAIN}|$AUTH_ADMIN_DOMAIN|g" \
      -e "s|{\$FRONTEND_HOST_PORT:4310}|$FRONTEND_HOST_PORT|g" \
      -e "s|{\$BACKEND_HOST_PORT:4311}|$BACKEND_HOST_PORT|g" \
      -e "s|{\$ADMINER_HOST_PORT:4312}|$ADMINER_HOST_PORT|g" \
      -e "s|{\$MINIO_HOST_PORT:4313}|$MINIO_HOST_PORT|g" \
      -e "s|{\$AUTH_HOST_PORT:4315}|$AUTH_HOST_PORT|g" \
      -e "s|{\$AUTH_ADMIN_HOST_PORT:4316}|$AUTH_ADMIN_HOST_PORT|g" \
      -e "s|{\$ADMIN_AUTH_USER}|$ADMIN_AUTH_USER|g" \
      -e "s|{\$ADMIN_AUTH_BCRYPT}|$ADMIN_AUTH_BCRYPT|g" \
      "$1"
}

if [ "$DO_INSTALL" -eq 0 ]; then
  render infra/caddy/izyah.caddyfile
  if [ "$WITH_AUTH" -eq 1 ]; then render infra/caddy/izyah-auth.caddyfile; fi
  say ""
  say "  ${DIM}Nothing was written. To install it:  sudo $0 --install${OFF}"
  exit 0
fi

# ------------------------------------------------------------------------ install
step "Installing the Caddy sites for ${APP_DOMAIN}"

[ "$(id -u)" -eq 0 ] || die "--install writes under /etc/caddy — re-run it with sudo."
command -v caddy >/dev/null 2>&1 ||
  die "caddy is not installed. See https://caddyserver.com/docs/install#debian-ubuntu-raspbian"

install -d -m 0755 "$SITE_DIR"
render infra/caddy/izyah.caddyfile > "$SITE_DIR/izyah.caddyfile.new"
chmod 0644 "$SITE_DIR/izyah.caddyfile.new"

if [ "$WITH_AUTH" -eq 1 ]; then
  [ -n "$AUTH_DOMAIN" ] && [ -n "$AUTH_ADMIN_DOMAIN" ] ||
    die "--with-auth needs AUTH_DOMAIN and AUTH_ADMIN_DOMAIN in .env."
  render infra/caddy/izyah-auth.caddyfile > "$SITE_DIR/izyah-auth.caddyfile.new"
  chmod 0644 "$SITE_DIR/izyah-auth.caddyfile.new"
elif [ -f "$SITE_DIR/izyah-auth.caddyfile" ]; then
  warn "logto blocks are installed but --with-auth was not passed; leaving them in place."
  warn "  Remove them with: rm $SITE_DIR/izyah-auth.caddyfile && systemctl reload caddy"
fi

# Caddy reads one Caddyfile. A per-app file is worth nothing until the main one
# imports the directory, and a missing import is silent: Caddy reloads happily
# and simply never answers for these hosts.
if [ ! -f "$MAIN_CADDYFILE" ]; then
  printf '%s\n' "$IMPORT_LINE" > "$MAIN_CADDYFILE"
  ok "created $MAIN_CADDYFILE with the import"
elif ! grep -qF "$SITE_DIR" "$MAIN_CADDYFILE"; then
  printf '\n# Per-app site blocks, one file each.\n%s\n' "$IMPORT_LINE" >> "$MAIN_CADDYFILE"
  ok "added the import to $MAIN_CADDYFILE"
else
  ok "$MAIN_CADDYFILE already imports $SITE_DIR"
fi

mv "$SITE_DIR/izyah.caddyfile.new" "$SITE_DIR/izyah.caddyfile"; ok "$SITE_DIR/izyah.caddyfile"
if [ "$WITH_AUTH" -eq 1 ]; then
  mv "$SITE_DIR/izyah-auth.caddyfile.new" "$SITE_DIR/izyah-auth.caddyfile"; ok "$SITE_DIR/izyah-auth.caddyfile"
fi

# Validate before reloading. A reload on a bad config leaves the old one serving
# and still reports success, so the next restart — days later, for an unrelated
# reason — is what actually takes every site on this box down.
if caddy validate --config "$MAIN_CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
  ok "config validates"
else
  caddy validate --config "$MAIN_CADDYFILE" --adapter caddyfile || true
  die "the Caddyfile does not validate. The site files are in place but Caddy was NOT
       reloaded, so nothing changed for the sites already running.
       An 'ambiguous site definition' here means one of these hostnames is also
       defined by hand in $MAIN_CADDYFILE — delete that copy, not this one."
fi

# Validation passing does not mean loading will: it checks syntax, not whether a
# port can be bound or a file opened. Do not hide a failure behind `&& ok`.
if systemctl reload caddy; then
  ok "caddy reloaded"
else
  say ""
  systemctl status caddy --no-pager --lines=15 >&2 || true
  die "caddy did not reload, so these sites are NOT live. The previously running
       config is still serving, so other apps on this box are unaffected — but a
       'systemctl restart caddy' would now fail and take them down too."
fi

say ""
say "  ${BOLD}Routed${OFF}"
say "    https://${APP_DOMAIN}              -> 127.0.0.1:${FRONTEND_HOST_PORT}  (frontend)"
say "    https://${API_DOMAIN}              -> 127.0.0.1:${BACKEND_HOST_PORT}  (backend, incl. Socket.IO)"
say "    https://${MINIO_CONSOLE_DOMAIN}    -> 127.0.0.1:${MINIO_HOST_PORT}  (media/avatars)"
say "    https://${ADMINER_DOMAIN}          -> 127.0.0.1:${ADMINER_HOST_PORT}  (adminer, behind basic auth)"
[ "$WITH_AUTH" -eq 1 ] && say "    https://${AUTH_DOMAIN} and ${AUTH_ADMIN_DOMAIN} -> logto"
say ""
say "  ${BOLD}Next${OFF}"
say "   1. point an A/AAAA record for each of those names at this host — ACME will"
say "      not issue a certificate for a name that does not resolve here."
say "   2. open 80 and 443 only. The ${FRONTEND_HOST_PORT}-${AUTH_ADMIN_HOST_PORT} range is on loopback."
say "   3. watch the certificates being issued:  ${DIM}journalctl -u caddy -f${OFF}"
say "   4. confirm:  ${DIM}curl -fsS https://${APP_DOMAIN}/${OFF}"
say ""
