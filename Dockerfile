FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates poppler-utils poppler-data && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/server ./server
# Route publication runs the same renderer preflight as the browser.
COPY --from=build --chown=node:node /app/src/vendor/learning-path-3d ./src/vendor/learning-path-3d
USER node
ENV NODE_ENV=production THREADPEAK_HOST=0.0.0.0 THREADPEAK_PORT=4312
EXPOSE 4312
CMD ["node", "--experimental-strip-types", "server/main.ts"]

FROM caddy:2-alpine AS web
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
