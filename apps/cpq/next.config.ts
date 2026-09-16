import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';
import type { NextConfig } from 'next';

/**
 * Nexora CPQ — the quoting microfrontend.
 *
 * Owns everything commercial: the product catalogue, the configurator, pricing,
 * discounts, approvals and quote documents. It is deployed independently of the
 * Platform app and must never import Platform's internal components — the two
 * communicate through URLs, shared packages and the database only (docs/MFE.md).
 */
const appDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(appDir, '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
    ignoreBuildErrors: false,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  serverExternalPackages: ['@prisma/client', '@prisma/adapter-neon', '@react-pdf/renderer'],

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
