import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';
import type { NextConfig } from 'next';

/**
 * Nexora Platform — the DEFAULT microfrontend application.
 *
 * It owns the shell: authentication, navigation, dashboard, customers and
 * profile. `microfrontends.json` lives here because the default app is what
 * declares the routing table for the whole group; the CPQ app receives a copy
 * so it can be developed and deployed independently.
 *
 * Environment: this is a monorepo with one `.env` at the repository root.
 * Next.js only looks in the app directory, so the root file is loaded
 * explicitly here. On Vercel the platform injects real environment variables
 * and this call is a harmless no-op.
 */
const appDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(appDir, '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them directly. This keeps the packages free of a bundler
  // and means a change in a package is picked up by hot reload immediately.
  transpilePackages: [
    '@nexora/ui',
    '@nexora/types',
    '@nexora/validation',
    '@nexora/auth',
    '@nexora/db',
    '@nexora/cpq-engine',
    '@nexora/observability',
  ],

  typescript: {
    // Never ship a build that does not typecheck.
    ignoreBuildErrors: false,
  },

  experimental: {
    // Prisma's generated client must not be bundled into server chunks.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Prisma's query engine is a native binary; it has to stay external.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-neon'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withMicrofrontends(nextConfig);
