# syntax=docker/dockerfile:1
# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_OIDC_ISSUER
ARG VITE_OIDC_CLIENT_ID

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_OIDC_ISSUER=$VITE_OIDC_ISSUER
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage (nginx serves static build) ---------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Use 127.0.0.1 (not localhost): nginx listens on IPv4 only, and "localhost"
# can resolve to ::1 first, making the check fail and the container look unhealthy.
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
