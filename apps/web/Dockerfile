# syntax=docker/dockerfile:1
# HaulGenius web admin — build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t haulgenius-web .
# Railway: apps/web/railway.json. docs/deployment.md
FROM node:22.13-bookworm-slim AS base
WORKDIR /app

FROM base AS build
# NEXT_PUBLIC_* values are inlined at build time (Railway passes service
# variables as build args when declared here).
ARG NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_MAP_STYLE_URL=${NEXT_PUBLIC_MAP_STYLE_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm ci --include-workspace-root \
      -w web -w @dispatcher/shared -w @dispatcher/i18n -w @dispatcher/api-client \
      -w @dispatcher/design-tokens -w @dispatcher/tsconfig \
  && npx turbo run build --filter=web

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# Standalone server (output: 'standalone', traced from the monorepo root) +
# the static assets it does not copy by itself.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
