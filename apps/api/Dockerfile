# syntax=docker/dockerfile:1
# HaulGenius API — build from the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t haulgenius-api .
# Railway: apps/api/railway.json (pre-deploy runs migrations). docs/deployment.md
FROM node:22.13-bookworm-slim AS base
# OpenSSL + CA certs for Prisma's schema engine (migrations) and TLS to managed services.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
# Only the workspaces the api needs (no Expo/React Native, no Next).
# `prisma generate` runs in the api's postinstall; prisma.config.ts reads
# DATABASE_URL, so a placeholder is enough at build time (no connection).
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    npm ci --include-workspace-root \
      -w api -w @dispatcher/shared -w @dispatcher/i18n -w @dispatcher/tsconfig \
  && npx turbo run build --filter=api

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Full workspace (built packages + node_modules incl. prisma CLI and tsx,
# needed by the pre-deploy migrations / marketplace refresh).
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/main"]
