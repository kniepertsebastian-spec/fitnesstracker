FROM node:22-alpine AS base
WORKDIR /app
# Prisma's query/schema engine binaries dynamically link against OpenSSL, which the alpine
# base image doesn't ship by default (Node bundles its own, statically linked, which doesn't
# help other binaries) — without this, prisma commands fail at runtime with an engine load
# error, not a helpful message (see https://pris.ly/d/openssl for Prisma's own Alpine note).
RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @fitnesstracker/shared build
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
RUN pnpm install --frozen-lockfile --prod
WORKDIR /app/backend
EXPOSE 3000
# The --prod install above is a fresh one (doesn't reuse the build stage's node_modules), and
# @prisma/client's own postinstall can't auto-locate the schema in this monorepo layout, so the
# generated client binding never lands here — regenerate it explicitly before every start,
# alongside the existing migrate-on-boot step (schema is already correct, so this is fast and
# fully offline: no engine binaries need downloading).
CMD ["sh", "-c", "pnpm prisma:generate && pnpm prisma:deploy && node dist/server.js"]
