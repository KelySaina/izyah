# Auth & Identity — setup

Izy'Ah uses a **two-credential** identity model so the frictionless "just start
using it" experience is preserved while real accounts (recovery + cross-device)
become possible.

| Credential | Minted when | Verified by | Purpose |
|---|---|---|---|
| **Session token** (HMAC) | first visit (`POST /api/auth/anonymous`) | backend, with `SESSION_SECRET` | frictionless anonymous identity |
| **OIDC token** (JWT) | user taps "Sign in / claim" | Logto JWKS | links/recovers a real account |

Both travel as `Authorization: Bearer <token>` (and in the Socket.IO handshake as
`auth.token`). The user **id is never a credential** on its own — a leaked id
can't be replayed.

---

## Status

**Done (M1 — shipped):**
- Signed session tokens for REST **and** sockets (closes the old "raw `X-User-ID`
  is the credential" hole). No IdP required; the app runs anonymous-only.
- `POST /api/auth/anonymous`, `GET /api/auth/me`; private `MeDTO` (never leaks
  email into public creator/attendee lists).
- Prisma `User.authSubject` column ready for OIDC linking.

**Done (M2 — code shipped, needs Logto provisioning to activate):**
- Backend: `jose` ID-token verification (JWKS via OIDC discovery), `POST /api/auth/link`
  (verify → link-by-subject / login-by-verified-email / upgrade-anonymous / create),
  `POST /api/auth/logout`.
- Frontend: `@logto/browser` SPA SDK, "Save your account" button in Profile, `/callback`
  route, sign-out. All gated on `VITE_OIDC_*` being present (else UI stays hidden).
- Inert until `OIDC_ISSUER` (backend) + `VITE_OIDC_*` (frontend) are set — see §3.

**Not yet done:** merging an anonymous user's events into a pre-existing account
on first sign-in (currently the anonymous row is abandoned in that case).

---

## 1. Bring Logto up

Logto is gated behind the `auth` compose profile, so it stays dormant during a
normal `up` / `setup.sh` / CI deploy and only starts when you opt in.

**Dev (host-native apps + infra in Docker):**
```bash
docker compose -f docker-compose.dev.yml up -d postgres
# First run only — create Logto's own database:
docker compose -f docker-compose.dev.yml exec postgres createdb -U izyah logto
docker compose -f docker-compose.dev.yml --profile auth up -d logto
```
- OIDC endpoint: http://localhost:3001
- Admin console: http://localhost:3002

**Prod (full stack):** `logto` is in `docker-compose.yml` behind the `auth` profile,
published on `127.0.0.1:${AUTH_HOST_PORT}` and `:${AUTH_ADMIN_HOST_PORT}`. On a
pre-existing Postgres volume, create the `logto` DB once (the `init.sql` only
auto-creates it on a fresh volume), then start it with the profile:
```bash
docker compose exec postgres createdb -U "$POSTGRES_USER" logto
docker compose --profile auth up -d logto
```
Routing is a second step, and deliberately so: the site blocks for
`AUTH_DOMAIN` / `AUTH_ADMIN_DOMAIN` live in `infra/caddy/izyah-auth.caddyfile` and
are installed only on request, because installing them while logto is down would
have Caddy fetch certificates for both names and then answer 502 on every request:
```bash
sudo ./scripts/caddy-site.sh --install --with-auth
```
> Keep `AUTH_ADMIN_DOMAIN` internal / IP-restricted in production. Nothing in this
> repo restricts it — the admin console is reachable by anyone who knows the name
> once that site block is installed.

## 2. Register the apps in the Logto console

Open the admin console, finish the first-run admin setup, then:

1. **Applications → Create → Single Page App**
   - Redirect URI: `<APP_URL>/callback` — dev `http://localhost:5173/callback`,
     prod e.g. `https://144.91.123.212.nip.io/callback`. Must match exactly.
   - Post-sign-out URI: your `APP_URL`.
   - Copy the **App ID** → `OIDC_CLIENT_ID` / `VITE_OIDC_CLIENT_ID`.
2. **API resources → Create**
   - Identifier (audience) → `OIDC_AUDIENCE` (optional; the ID-token flow doesn't require it).
3. (Optional) **Connectors** → add Google / email so social + magic-link work.

## 3. Fill env

**Backend** — `.env` (dev: `apps/backend/.env`; prod: root `.env`, written by `setup.sh`):
```dotenv
SESSION_SECRET=<openssl rand -hex 32>          # REQUIRED, non-default in prod
APP_URL=https://144.91.123.212.nip.io          # dev: http://localhost:5173
OIDC_ISSUER=http://localhost:3001/oidc         # prod: https://<AUTH_DOMAIN>/oidc
OIDC_CLIENT_ID=<App ID from step 2.1>
OIDC_AUDIENCE=                                 # optional
```

**Frontend** — build-time vars (dev: `apps/frontend/.env`; prod: compose build args,
already wired from `OIDC_ISSUER` / `OIDC_CLIENT_ID`):
```dotenv
VITE_OIDC_ISSUER=http://localhost:3001/oidc
VITE_OIDC_CLIENT_ID=<App ID from step 2.1>
```
Leaving `OIDC_ISSUER` / `VITE_OIDC_*` empty keeps linking disabled (anonymous-only);
the "Save your account" button simply doesn't render.

## 4. Apply the schema change (once)

```bash
cd apps/backend && npm run db:push && npm run db:generate
```

## 5. Test the flow (dev)

Run infra + Logto + apps, open the app, go to **Profile → Save your account** → you're
redirected to Logto → sign up/in → back to `/callback` → linked. Verify:
- `GET /api/auth/me` now returns `isClaimed: true` + your `email`;
- clearing the browser then **Save your account** with the same email lands you back on
  the *same* user (recovery); a second browser does the same (cross-device).
