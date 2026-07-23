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

**Pending (M2 — after Logto is provisioned):**
- Backend: verify Logto JWTs via JWKS (`jose`), `POST /api/auth/link`,
  `POST /api/auth/logout`, and the link/merge/login logic in `identity` middleware.
- Frontend: Logto SPA SDK, "Sign in" button, `/callback` route, Profile claim UI.

---

## 1. Bring Logto up

**Dev (host-native apps + infra in Docker):**
```bash
docker compose -f docker-compose.dev.yml up -d postgres
# First run only — create Logto's own database:
docker compose -f docker-compose.dev.yml exec postgres createdb -U izyah logto
docker compose -f docker-compose.dev.yml up -d logto
```
- OIDC endpoint: http://localhost:3001
- Admin console: http://localhost:3002

**Prod (full stack):** `logto` is already wired into `docker-compose.yml` behind
Traefik at `AUTH_DOMAIN` / `AUTH_ADMIN_DOMAIN`. On a pre-existing Postgres volume,
create the `logto` DB once (the `init.sql` only auto-creates it on a fresh volume):
```bash
docker compose exec postgres createdb -U "$POSTGRES_USER" logto
```
> Keep `AUTH_ADMIN_DOMAIN` internal / IP-restricted in production.

## 2. Register the apps in the Logto console

Open the admin console, finish the first-run admin setup, then:

1. **Applications → Create → Single Page App**
   - Redirect URI: `http://izyah.localhost/callback` (prod) / `http://localhost:5173/callback` (dev)
   - Post-sign-out URI: your `APP_URL`
   - Copy the **App ID** → `OIDC_CLIENT_ID`.
2. **API resources → Create**
   - Identifier (audience), e.g. `https://api.izyah.localhost` → `OIDC_AUDIENCE`.
3. (Optional) **Connectors** → add Google / email so social + magic-link work.

## 3. Fill `.env`

```dotenv
SESSION_SECRET=<openssl rand -hex 32>          # REQUIRED, non-default in prod
APP_URL=http://izyah.localhost
OIDC_ISSUER=http://auth.izyah.localhost/oidc   # dev: http://localhost:3001/oidc
OIDC_AUDIENCE=https://api.izyah.localhost
OIDC_CLIENT_ID=<App ID from step 2.1>
```
Leaving `OIDC_ISSUER` empty keeps account-linking disabled (anonymous-only).

## 4. Apply the schema change

```bash
cd apps/backend && npm run db:push && npm run db:generate
```

Once these are in place, ping me to wire **M2** (the OIDC verify + claim flow).
