# Izy'Ah — backup-cron sidecar. Node (to run backup-cron.js's scheduler) plus
# the client tools scripts/backup.sh needs to talk to Postgres/Redis/MinIO
# over the shared docker network — no Docker socket, no docker CLI. See that
# script's header for why avoiding the socket matters here.
FROM minio/mc:latest AS mc

FROM node:20-alpine

RUN apk add --no-cache bash postgresql16-client redis curl
COPY --from=mc /usr/bin/mc /usr/local/bin/mc

WORKDIR /app/scripts
COPY scripts/package.json scripts/package-lock.json* ./
RUN npm install --omit=dev

WORKDIR /app
COPY . .

CMD ["node", "scripts/backup-cron.js"]
