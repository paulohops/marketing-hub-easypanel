# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm check && pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8978 \
    STORAGE_DIR=/data/storage

RUN corepack enable && mkdir -p /data/storage
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
COPY --from=build /app/scripts/ensure-schema.mjs ./scripts/ensure-schema.mjs
COPY --from=build /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x scripts/entrypoint.sh

VOLUME ["/data/storage"]
EXPOSE 8978

CMD ["./scripts/entrypoint.sh"]
