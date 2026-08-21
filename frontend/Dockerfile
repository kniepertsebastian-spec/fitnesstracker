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
COPY packages/shared packages/shared
COPY frontend frontend
RUN pnpm --filter @fitnesstracker/shared build
RUN pnpm --filter frontend build

FROM scratch AS export
COPY --from=build /app/frontend/dist /dist
