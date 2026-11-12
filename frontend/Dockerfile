# Build-only image: the output (dist/) is bind-mounted/copied for Caddy to serve as static
# files. There is no frontend "runtime" container in production.
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY frontend/src frontend/src
COPY frontend/public frontend/public
COPY frontend/index.html frontend/index.html
COPY frontend/vite.config.ts frontend/vite.config.ts
# Tailwind 4 runs as a PostCSS plugin. Without this file Vite silently skips it and ships the
# raw `@import "tailwindcss"` source (no utilities, no theme) — the app then renders unstyled.
COPY frontend/postcss.config.js frontend/postcss.config.js
COPY frontend/tsconfig.json frontend/tsconfig.json
RUN pnpm --filter @fitnesstracker/shared build
RUN pnpm --filter frontend build

FROM scratch AS export
# Copy to the export stage's root, not /dist — `docker build --output frontend/dist .` dumps
# this stage's root filesystem into that host directory, so copying to /dist here would nest
# the actual build output one level too deep (frontend/dist/dist/index.html), which is exactly
# where Caddy's volume mount (./frontend/dist:/srv/frontend) would never find it.
COPY --from=build /app/frontend/dist /
