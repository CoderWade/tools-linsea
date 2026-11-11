# Deployment image for the Timeminer tools site.
#
# Two stages: build the Vite bundle, then serve it together with the four
# exchange-rate relays from one small runtime image. nginx (on the host) proxies
# tools.timeminer.cc to port 8100 and routes /api/* to the matching relay port.

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

# Only the production deps are needed to serve the static bundle via `serve`.
RUN npm install --no-audit --no-fund --omit=dev serve@14 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

# Relay sources read credentials from the environment; nothing is baked in.
ENV NODE_ENV=production

EXPOSE 8100 8788 8789 8790 8791

CMD ["sh", "-c", "\
  node server/unionpay-proxy.mjs & \
  node server/source-proxy.mjs & \
  node server/visa-proxy.mjs & \
  node server/mastercard-proxy.mjs & \
  npx serve -s dist -l 8100 & \
  wait"]
