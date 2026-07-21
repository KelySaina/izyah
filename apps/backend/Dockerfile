# syntax=docker/dockerfile:1
# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (incl. dev) with the lockfile if present.
COPY package.json package-lock.json* ./
RUN npm install

# Generate Prisma client + compile TypeScript.
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage --------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only production deps in the final image.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Prisma client (generated) + schema + compiled app + entrypoint.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# tsx is needed to run the TS seed script at container start.
RUN npm install --no-save tsx@^4.19.2

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
