# Izy'Ah — backup-cron sidecar. Node (to run backup-cron.js's scheduler) plus
# the client tools scripts/backup.sh needs to talk to Postgres/Redis/MinIO
# over the shared docker network — no Docker socket, no docker CLI. See that
# script's header for why avoiding the socket matters here.
# minio/mc was deleted from Docker Hub in September 2026, so this stage stopped
# building at all. Same Chainguard image the stack runs, used here only as a
# source for the `mc` binary — which is static, so it runs in the musl-based
# node:20-alpine below despite coming from a glibc image (verified).
FROM cgr.dev/chainguard/minio@sha256:a05a4497e8dce3cb7a7a1bf1872ba5d30ea988f1e8c22c9e0920503761c4b5f1 AS mc

FROM node:20-alpine

RUN apk add --no-cache bash postgresql16-client redis curl
COPY --from=mc /usr/bin/mc /usr/local/bin/mc

WORKDIR /app/scripts
COPY scripts/package.json scripts/package-lock.json* ./
RUN npm install --omit=dev

WORKDIR /app
COPY . .

CMD ["node", "scripts/backup-cron.js"]
