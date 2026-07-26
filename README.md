# Izy'Ah — events, together

**Izy'Ah** is an attendee-first event platform. It's the easiest way to create, share,
join and experience events — before, during and after they happen. There are **no login
screens and no signup form**: every visitor gets a persistent identity automatically and
can immediately create or join events. Creating an event makes you its host, with
host-only tools (edit, ticket scanning, analytics) scoped to that one event — there's
still no separate "organizer account" tier or subscription plan.

This repository is a production-ready **SaaS foundation** (monorepo) that runs end-to-end
with a single `docker compose up`, and a one-shot `./setup.sh` for a real VPS.

---

## Table of contents

1. [Features](#features)
2. [Architecture overview](#architecture-overview)
3. [Architecture diagram](#architecture-diagram)
4. [Project structure](#project-structure)
5. [Tech stack](#tech-stack)
6. [Quick start (Docker)](#quick-start-docker)
7. [Local development (hot reload)](#local-development-hot-reload)
8. [Environment variables](#environment-variables)
9. [Docker commands](#docker-commands)
10. [Database &amp; Prisma](#database--prisma)
11. [API &amp; realtime](#api--realtime)
12. [Identity model](#identity-model)
13. [Testing](#testing)
14. [PWA &amp; future mobile (Capacitor)](#pwa--future-mobile-capacitor)
15. [Security](#security)
16. [Analytics](#analytics)
17. [Roadmap](#roadmap)
18. [Deployment](#deployment)

---

## Features

- **Anonymous-first identity, upgradable.** Start using the app with zero signup; tap
  "Save your account" any time to link a real email/Google identity (OIDC via Logto) for
  account recovery and cross-device sync — your existing events and history carry over.
  See [Identity model](#identity-model).
- **Events.** Cover photo, description, date/time, location (interactive map + address
  search via OpenStreetMap), capacity with automatic waitlist + promotion, and
  public (discoverable) / private (link-only) visibility.
- **RSVP.** Going / maybe / not going with live counts and avatars; a freed-up spot
  auto-promotes the longest-waiting person off the waitlist.
- **Attendance & ticketing.** Each event can optionally run in **Min PAF** mode (an
  in-person contribution the host marks as paid) or **Ticket** mode (attendees get a QR
  code, the host scans it at the door — or uses a manual check-in toggle as a fallback).
  This is lightweight, host-run *tracking*, not a payment processor: no money moves
  through the app.
- **Realtime chat** with live presence ("N online") and typing indicators.
- **Claimable tasks** — a shared to-do list attendees can claim, release, or mark done
  (with one-tap "potluck" quick-adds like 🥤 Drinks / 🍰 Dessert); the host is notified
  on every state change.
- **Polls** for group decisions, with live results.
- **Media gallery** — photo/video uploads (MinIO-backed), a lightbox, and a dedicated
  "recap" view once the event is past.
- **Notifications** — an in-app bell (with a search filter) plus browser/OS Web Push,
  covering RSVPs (going, maybe, and can't-go), waitlist promotion, tasks, and polls.
- **Host analytics.** A per-event dashboard (RSVP breakdown, invitation opens, messages,
  media) and an aggregated "your hosting stats" view in Profile across every event you've
  created — both with live, auto-refreshing 14-day bar charts, not just raw counters.
- **PWA** — installable, offline shell, dark/light theme, calendar (.ics) export, and a
  native share sheet.

---

## Architecture overview

Izy'Ah is a **monorepo** with two deployable apps (`frontend`, `backend`) and a set of
backing services wired together with Docker Compose and fronted by Traefik.

Key decisions and the *why* behind them:

- **Passwordless-first identity, with real account-linking shipped.** On first visit the
  frontend mints an anonymous identity (`POST /auth/anonymous`) and stores a *signed*
  session token — every request carries it as `Authorization: Bearer <token>`, never a
  raw user id (a leaked id alone can't be replayed). Tapping "Save your account" upgrades
  the same identity via OIDC (Logto): email/Google sign-in, recovery, cross-device sync.
  See [Identity model](#identity-model) and [SETUP-AUTH.md](SETUP-AUTH.md).
- **Feature-module backend.** Each domain (`auth`, `users`, `events`, `participants`,
  `messages`, `media`, `tasks`, `polls`, `notifications`) is a self-contained module of
  `*.schemas.ts` (Zod) → `*.service.ts` (Prisma + business logic) → `*.controller.ts`
  (HTTP glue) → `*.routes.ts` (Express router). This keeps features additive.
- **REST + WebSocket split.** CRUD and reads are REST; chat, presence, typing and live RSVP
  tallies are Socket.IO. The Socket.IO **Redis adapter** means we can scale the backend
  horizontally and still broadcast across instances.
- **Redis is core infrastructure**, not an afterthought: Socket.IO adapter, presence hashes,
  cache-aside for public event pages, a distributed rate-limit store, and the BullMQ broker.
- **Object storage via MinIO** (S3-compatible) so media handling is identical in dev and in
  any cloud (swap the endpoint + creds for AWS S3 / R2 / GCS).
- **Background jobs via BullMQ** for media processing and notification fan-out today; the
  same pattern hosts AI jobs in V3 without touching the request path.
- **Web-API abstraction layer on the frontend** (`cameraService`, `locationService`,
  `notificationService`, `storageService`) so the *same* Vue app becomes a Capacitor
  Android/iOS app later by swapping implementations — not the call sites.

## Architecture diagram

```
                                  ┌───────────────────────────────┐
                                  │            Browser / PWA       │
                                  │   Vue 3 + Pinia + Service W.    │
                                  └───────────────┬───────────────┘
                                 HTTP + WebSocket (Bearer token)
                                                  │
                                          ┌───────▼────────┐
                                          │    Traefik     │  :80 / :443
                                          │ reverse proxy  │  (routes by Host)
                                          └───┬────────┬───┘
                        izyah.localhost       │        │   api.izyah.localhost
                     ┌────────────────────────▼┐     ┌─▼───────────────────────────┐
                     │  Frontend (nginx)        │     │  Backend (Express+Socket.IO)│
                     │  static Vue build        │     │  REST /api + /socket.io     │
                     └──────────────────────────┘     └──┬─────────┬─────────┬──────┘
                                                         │         │         │
                                              ┌──────────▼─┐  ┌────▼────┐ ┌──▼───────┐
                                              │ PostgreSQL │  │  Redis  │ │  MinIO   │
                                              │  (Prisma)  │  │ adapter │ │ S3 store │
                                              └────────────┘  │ cache   │ └──────────┘
                                                              │ queues  │
                                                              └────┬────┘
                                                          ┌────────▼─────────┐
                                                          │ BullMQ workers   │
                                                          │ media / notif.   │
                                                          └──────────────────┘

   Admin: Adminer (db.izyah.localhost) · MinIO S3 (minio.izyah.localhost) · Traefik dash (traefik.izyah.localhost)
```

## Project structure

```
izyah/
├── docker-compose.yml            # full stack: `docker compose up`
├── docker-compose.dev.yml        # infra only (Postgres/Redis/MinIO/Adminer) for native dev
├── .env.example                  # root env consumed by compose
├── infra/
│   ├── traefik/                  # static + dynamic proxy config
│   ├── postgres/                 # init.sql (extensions)
│   ├── redis/                    # redis.conf
│   └── minio/                    # bucket bootstrap script
└── apps/
    ├── backend/                  # Express + Prisma + Socket.IO (izyah-backend)
    │   ├── prisma/               # schema.prisma + seed.ts
    │   └── src/
    │       ├── config/           # validated env
    │       ├── lib/              # prisma, redis, minio, cache, logger
    │       ├── middleware/       # identity (Bearer token), validate, error, rateLimit
    │       ├── modules/          # auth, users, events, participants, messages,
    │       │                     #   media, tasks, polls, notifications, health
    │       ├── realtime/         # Socket.IO server, presence, chat gateway
    │       ├── queue/            # BullMQ queues + workers
    │       ├── docs/             # OpenAPI / Swagger UI
    │       └── analytics/        # privacy-friendly event tracking
    └── frontend/                 # Vue 3 + Vite + Tailwind + Pinia PWA (izyah-frontend)
        └── src/
            ├── services/         # api, identity, socket + native abstraction layers
            ├── stores/           # Pinia: identity, events, chat, notifications, ui
            ├── lib/              # formatting, calendar (.ics) export
            ├── components/       # presentational + feature panels
            └── views/            # routed pages
```

## Tech stack

| Layer    | Choice                                                         |
| -------- | -------------------------------------------------------------- |
| Frontend | Vue 3, TypeScript, Vite, Composition API, Tailwind, Pinia, PWA |
| Backend  | Node.js, Express, TypeScript, Prisma                           |
| Database | PostgreSQL 16                                                  |
| Realtime | Socket.IO (+ Redis adapter)                                    |
| Cache/MQ | Redis 7 (cache, presence, rate-limit store, BullMQ broker)     |
| Storage  | MinIO (S3-compatible)                                          |
| Auth     | Logto (OIDC, optional) + signed HMAC session tokens             |
| Maps     | Leaflet + OpenStreetMap/Nominatim (keyless)                     |
| Tickets  | `qrcode` (generate) + `qr-scanner` (camera-based scan)          |
| Push     | Web Push API (VAPID)                                           |
| Proxy    | Traefik v3                                                     |
| DB admin | Adminer                                                        |
| Testing  | Jest + Supertest (backend); Vitest + Playwright (frontend)     |
| Quality  | ESLint + Prettier                                              |

## Quick start (Docker)

Prerequisites: Docker + Docker Compose v2.

```bash
cd izyah
cp .env.example .env          # tweak secrets for anything beyond local dev
docker compose up --build
```

Then open:

| URL                               | What                    |
| --------------------------------- | ----------------------- |
| http://izyah.localhost            | **The app** (PWA) |
| http://api.izyah.localhost/health | Backend health check    |
| http://api.izyah.localhost/docs   | Swagger UI (OpenAPI)    |
| http://db.izyah.localhost         | Adminer (DB admin)      |
| http://minio.izyah.localhost      | MinIO S3 endpoint       |
| http://traefik.izyah.localhost    | Traefik dashboard       |

> `*.localhost` hostnames resolve to `127.0.0.1` in modern browsers, so no `/etc/hosts`
> edits are needed. On first boot the backend syncs the Prisma schema and seeds demo data
> (3 users, one public event `summer-kickoff`, RSVPs, chat, tasks and a poll).

## Local development (hot reload)

Run the infrastructure in Docker and the apps natively for fast feedback:

```bash
# 1) Infra only (published to localhost ports)
docker compose -f docker-compose.dev.yml up -d

# 2) Backend
cd apps/backend
cp .env.example .env
npm install
npm run db:push            # sync schema
npm run db:seed            # optional demo data
npm run dev                # http://localhost:4000

# 3) Frontend (new terminal)
cd apps/frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

### Working across two machines

After the first-time setup above, use [`scripts/dev-sync.sh`](scripts/dev-sync.sh) to bring a
second computer up to date instead of repeating those steps by hand:

```bash
make sync          # pull, reconcile env, deps, infra, migrations
make sync-seed     # ...and re-seed demo data
```

It pulls (fast-forward only), then for each of the three gitignored env files (`.env`,
`apps/backend/.env`, `apps/frontend/.env`) **appends any key its `.env.example` has that
your file doesn't** — existing values are never modified, so machine-specific settings like
a remapped `DATABASE_URL` port survive. It then reinstalls deps only if a lockfile actually
changed, starts the dev infra (picking up a gitignored `docker-compose.local.yml` if you have
one), and runs `prisma generate` + `prisma migrate deploy`.

Two notes on why it does what it does:

- **`prisma generate` matters as much as the migrate.** Pulling a schema change without
  regenerating the client produces confusing runtime errors (`Unknown argument 'x'`) even
  though the schema and database are both correct.
- **A database that predates the migration history self-heals.** Prisma reports `P3005`
  and refuses to run; the script baselines it (marks existing migrations as applied) rather
  than suggesting `migrate reset`, which would wipe your local data. It prompts first,
  because baselining runs `db push --accept-data-loss` to square the schema.

Anything it rewrites is backed up alongside the original as `<file>.bak-<timestamp>`.

## Environment variables

Root `.env` (consumed by `docker-compose.yml`) — see [`.env.example`](.env.example) for the
full list. Highlights:

| Variable                                     | Purpose                                        |
| -------------------------------------------- | ---------------------------------------------- |
| `APP_DOMAIN` / `API_DOMAIN`              | Traefik host rules                             |
| `POSTGRES_*`, `DATABASE_URL`             | Postgres credentials + Prisma connection       |
| `REDIS_URL`                                | Redis connection                               |
| `MINIO_*`                                  | Object storage creds, buckets, public base URL |
| `CORS_ORIGINS`                             | Comma-separated allowed origins                |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | API rate limit                                 |
| `SEED_ON_START`                            | Seed demo data on backend boot                 |
| `VITE_API_URL`, `VITE_SOCKET_URL`        | Browser-facing API/WS URLs (build-time)        |
| `SESSION_SECRET`                           | HMAC key for anonymous session tokens — **must** be overridden in prod |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID`, `VITE_OIDC_*` | Logto account-linking; unset = anonymous-only ([SETUP-AUTH.md](SETUP-AUTH.md)) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`   | Web Push keys (`npx web-push generate-vapid-keys`); unset = no push delivery |
| `ANALYTICS_ENABLED`                        | Toggle the Redis-backed analytics counters      |

## Docker commands

```bash
docker compose up --build            # build + run everything
docker compose up -d                 # detached
docker compose logs -f backend       # tail a service
docker compose ps                    # status
docker compose down                  # stop (keep volumes/data)
docker compose down -v               # stop + wipe data volumes
docker compose build backend         # rebuild one image
```

## Database & Prisma

The schema lives in [`apps/backend/prisma/schema.prisma`](apps/backend/prisma/schema.prisma).

```bash
cd apps/backend
npm run db:push       # push schema to DB (no migration files — great for iterating)
npm run db:migrate    # create a versioned migration (prisma migrate dev)
npm run db:deploy     # apply committed migrations (prod / CI)
npm run db:seed       # idempotent demo data
npm run db:studio     # Prisma Studio GUI
```

> The Docker entrypoint prefers `prisma migrate deploy` when migrations are committed, and
> is **self-healing**: on an existing database that predates migrations (`P3005`), it
> baselines automatically (`db push` to catch up, then marks every migration applied) and
> tolerates being re-run mid-baseline after a crash (`P3008`). A fresh checkout with no
> migrations at all falls back to plain `db push`. See
> [`apps/backend/docker-entrypoint.sh`](apps/backend/docker-entrypoint.sh).

## API & realtime

- REST base: `/api` (see Swagger at `/docs`). All endpoints except `POST /api/auth/anonymous`,
  `POST /api/users` (bootstrap), and the public event read expect
  `Authorization: Bearer <token>`.
- Health: `GET /health` → `{ "status": "ok" }`; `GET /health/ready` checks DB + Redis.
- WebSocket: Socket.IO at `/socket.io`, authenticated by `auth: { token }` in the handshake.

Realtime events:

| Event                   | Direction | Payload                                                  |
| ----------------------- | --------- | -------------------------------------------------------- |
| `presence:join/leave` | c→s      | `eventId`                                              |
| `presence:update`     | s→c      | `{ eventId, count, userIds }`                          |
| `chat:message`        | c↔s      | `{ eventId, content }` → `MessageDTO`               |
| `chat:typing`         | c↔s      | `{ eventId, isTyping }` → `{ userId, displayName }` |
| `rsvp:update`         | s→c      | `{ eventId, counts }`                                  |
| `notification:new`    | s→c      | `Notification`                                         |

## Identity model

No registration screen, but a real two-credential model underneath (see
[SETUP-AUTH.md](SETUP-AUTH.md) for full setup):

| Credential | Minted when | Verified by | Purpose |
| --- | --- | --- | --- |
| **Session token** (HMAC) | first visit (`POST /auth/anonymous`) | backend, with `SESSION_SECRET` | frictionless anonymous identity |
| **OIDC token** (JWT) | user taps "Save your account" | Logto JWKS | links/recovers a real account |

Both travel as `Authorization: Bearer <token>` — for REST and in the Socket.IO handshake
(`auth.token`) alike. `identityService` mints/persists the token via the `storageService`
abstraction; `session.ts` holds it in memory for the API client and socket connection. The
backend `identity` middleware verifies the bearer token, touches `lastSeenAt`, and attaches
`req.userId`/`req.user`; `requireIdentity` guards protected routes.

Account-linking (email/Google via OIDC/Logto) is **shipped** but inert until `OIDC_ISSUER`
(backend) and `VITE_OIDC_*` (frontend) are configured — until then, the "Save your account"
button simply doesn't render and the app runs anonymous-only.

## Testing

```bash
# Backend
cd apps/backend
npm test                       # Jest + Supertest (health + schema unit tests run anywhere)

# Frontend
cd apps/frontend
npm run test:unit              # Vitest (lib + component tests)
npm run test:e2e:install       # one-time: install Playwright browsers
npm run test:e2e               # Playwright smoke (mocks the API, no backend needed)
```

Integration tests that touch the DB/Redis expect the dev infra
(`docker compose -f docker-compose.dev.yml up -d`).

## PWA & future mobile (Capacitor)

The frontend is an installable PWA (manifest, service worker via `vite-plugin-pwa`,
maskable icons, offline shell, safe-area aware, mobile-first). Install it from the browser's
"Add to Home Screen".

Because all device concerns go through abstraction services
(`cameraService`, `locationService`, `notificationService`, `storageService`) and never call
browser APIs directly from components, wrapping the **same** Vue app with **Capacitor** later
is additive:

1. `npm i @capacitor/core @capacitor/cli && npx cap init`
2. Add `android`/`ios` platforms.
3. Swap the *bodies* of the abstraction services for Capacitor plugins
   (`@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/push-notifications`,
   `@capacitor/preferences`). Call sites are unchanged.

Icons: SVG icons ship in `public/icons`. To generate raster PWA assets, run
`npx @vite-pwa/assets-generator` against a 512×512 source.

## Security

- **Zod** validation on every request part (body/query/params) via the `validate` middleware.
- **Helmet** security headers + Traefik security-headers middleware.
- **CORS** allow-list from `CORS_ORIGINS`.
- **Rate limiting** backed by Redis (per identity/IP), stricter on write endpoints (chat/media).
- **Secure uploads**: type + size limits (25 MB, images/videos), stored in MinIO; uploads go
  through the API, never direct-to-bucket.
- **Input sanitization** (whitespace-collapsing, length caps) on user text.
- **Secrets via environment variables**; nothing sensitive is committed (`.env` is git-ignored).

## Analytics

Privacy-friendly by design: only aggregate counters (event creation, invitation opens, RSVP
conversion, messages, uploads) are recorded in Redis, bucketed both lifetime and per-day —
no PII, no cross-site identifiers. See `apps/backend/src/analytics/track.ts`.

Two user-facing dashboards read from these counters, both self/creator-scoped (never another
user's data) and rendered as live 14-day bar charts rather than bare numbers:

- **Per-event** (`GET /events/:id/analytics`) — host-only, opened from "View analytics" on
  the event page.
- **Aggregated across every event you've created** (`GET /users/me/analytics`) — "View
  analytics" in Profile.

Both poll every few seconds while open, so numbers update without closing/reopening the
sheet. A future job can still ship the raw Redis aggregates to a warehouse.

## Roadmap

- **V1 (shipped):** anonymous-first identity + OIDC account-linking, profile, dashboard,
  event CRUD + public share URLs, RSVP with live counts/avatars/waitlist, realtime chat
  (presence + typing), calendar export & upcoming view.
- **V2 (shipped):** claimable tasks, polls, media albums (MinIO + BullMQ worker),
  attendance & ticketing (Min PAF / QR ticket + scanner), notifications (in-app + Web
  Push, BullMQ), host analytics dashboards.
- **V3 (prepared, not implemented):** merging an anonymous user's events into a
  pre-existing account on first sign-in (currently the anonymous row is abandoned); AI
  features (descriptions, schedules, checklists, summaries, recommendations) as BullMQ
  jobs on a dedicated AI worker; shipping Redis analytics aggregates to a warehouse.

## Deployment

**One-shot VPS provisioning:** `./setup.sh` — idempotent, prompts for what it needs if run
with no flags. Picks up TLS automatically:

```bash
./setup.sh --domain izyah.example.com --email you@example.com   # real domain, Let's Encrypt
./setup.sh --nip --email you@example.com                        # no domain — free HTTPS via nip.io
./setup.sh --http                                                # plain HTTP on the IP — testing only
```

**CI/CD** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): every push to
`main` runs backend + frontend tests as a gate, then on green builds and pushes images to
`ghcr.io`, then SSHes to the VPS and runs [`scripts/deploy.sh`](scripts/deploy.sh) — pull,
recreate, health-gate, and **automatically roll back** on a failed health check.

Doing it by hand instead:

1. Point DNS for your app + API subdomains at the host.
2. Set real secrets in `.env` and production `VITE_API_URL`/`VITE_SOCKET_URL`.
3. Enable TLS: uncomment the `certificatesResolvers` block in
   [`infra/traefik/traefik.yml`](infra/traefik/traefik.yml), set an ACME email, add
   `tls.certresolver=letsencrypt` + the `websecure` entrypoint to the router labels, and the
   HTTP→HTTPS redirect on the `web` entrypoint.
4. Use a managed Postgres/Redis and an S3 provider in production (swap the MinIO env for real
   S3 credentials) for durability and backups.
5. Run the backend and a separate worker process (`npm run worker`) for horizontal scaling;
   the Socket.IO Redis adapter + sticky sessions (already labeled) handle multi-replica.

Optional: [SETUP-AUTH.md](SETUP-AUTH.md) to provision Logto and enable account-linking —
the app runs anonymous-only without it.

**Moving to a different VPS/provider?** Postgres, Redis, and MinIO all live in Docker
volumes local to that box's disk — they don't follow you automatically.
[`scripts/backup.sh`](scripts/backup.sh) (run on the old box, inside the `backup`
container: `docker compose exec backup bash scripts/backup.sh`) and
[`scripts/restore.sh`](scripts/restore.sh) (run on the new one, after `./setup.sh`) cover
the full move: database, uploaded media, and matching secrets so existing sessions keep
working. See either script's header comment for the exact steps.

**Backups run on a schedule automatically** — the `backup` service in `docker-compose.yml`
(a small sidecar, [`infra/backup/Dockerfile`](infra/backup/Dockerfile) +
[`scripts/backup-cron.js`](scripts/backup-cron.js) on `node-cron`) runs `backup.sh` weekly
by default. No OS crontab to install; it comes up with everything else on
`docker compose up -d --build`. Configure via root `.env`:

| Variable          | Purpose                                                         |
| ------------------ | ---------------------------------------------------------------- |
| `BACKUP_SCHEDULE` | Cron expression. Blank = weekly, Sundays 03:30 UTC.              |
| `BACKUP_KEEP`      | How many archives to keep in `backups/`; oldest pruned after each run. Blank = 8. |

It talks to Postgres/Redis/MinIO over the shared network like an ordinary client
(`pg_dumpall`, `redis-cli`, `mc`) — deliberately no Docker socket mount, since an
unattended, scheduled container with Docker Engine API access is one compromised
dependency away from root on the host.

---

Built as a clean, evolvable foundation — ship the web MVP, validate adoption, then grow into
mobile and AI without rewrites.
