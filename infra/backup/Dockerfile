# Izy'Ah — backup-cron sidecar. Node (to run backup-cron.js's scheduler) plus
# a Docker CLI (to run scripts/backup.sh's `docker compose exec`/`docker cp`
# against the sibling containers, over the socket mounted in by compose).
FROM node:20-alpine

RUN apk add --no-cache bash docker-cli docker-cli-compose

WORKDIR /app/scripts
COPY scripts/package.json scripts/package-lock.json* ./
RUN npm install --omit=dev

WORKDIR /app
COPY . .

CMD ["node", "scripts/backup-cron.js"]
