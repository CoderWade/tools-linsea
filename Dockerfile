# Deployment image for the Timeminer tools site.
#
# Two stages: build the Vite bundle, then serve it together with the four
# exchange-rate relays and the daily snapshot service from one runtime image.
# nginx (on the host) proxies tools.timeminer.cc to port 8100 and routes /api/*
# to the matching relay port.

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine
WORKDIR /app

# `serve` hosts the static bundle; wget/curl are used by the health check and by
# the systemd timer that triggers the daily snapshot.
RUN npm install --no-audit --no-fund --omit=dev serve@14 \
 && apk add --no-cache wget curl \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

# Snapshots are written here; docker-compose mounts a named volume so they
# survive container rebuilds.
ENV NODE_ENV=production \
    SNAPSHOT_DIR=/app/data
RUN mkdir -p /app/data

# Relay sources read credentials from the environment; nothing is baked in.
EXPOSE 8100 8788 8789 8790 8791 8792

CMD ["sh", "-c", "\
  node server/unionpay-proxy.mjs & \
  node server/source-proxy.mjs & \
  node server/visa-proxy.mjs & \
  node server/mastercard-proxy.mjs & \
  node server/snapshot.mjs & \
  npx serve -s dist -l 8100 & \
  wait"]
