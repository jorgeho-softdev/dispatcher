import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Self-contained server (.next/standalone/…/server.js) for the Docker image.
  // Tracing starts at the monorepo root so the shared workspace packages
  // (@dispatcher/*) are copied in too. See docs/deployment.md.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
