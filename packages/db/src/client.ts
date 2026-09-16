import { PrismaNeon } from '@prisma/adapter-neon';

import { PrismaClient } from './generated/prisma/client';

/**
 * The Prisma client singleton.
 *
 * The `server-only` guard lives on the package entry point (src/index.ts)
 * rather than here, and `./client` is deliberately not a public subpath export.
 * Apps can therefore only reach this module through the guarded entry, so an
 * accidental import from a Client Component still fails the build instead of
 * shipping database credentials to the browser — while the seed script, which
 * runs in plain Node outside Next's bundler, can import this file directly.
 * `server-only` throws under a normal Node resolver, so guarding this file
 * would have made the database unseedable.
 *
 * Connection strategy (Prisma 7 + Neon):
 *   - The runtime uses the POOLED url through the Neon serverless driver
 *     adapter. On Vercel, each request may land in a fresh isolate, so holding
 *     raw TCP connections would exhaust Postgres' connection limit quickly.
 *   - Prisma Migrate uses the DIRECT url instead, configured in
 *     prisma.config.ts, because migrations need advisory locks a pooler drops.
 *
 * In development the instance is cached on `globalThis` so Next.js hot reload
 * does not open a new pool on every edit.
 */

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and provide a PostgreSQL connection string.',
    );
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

const globalForPrisma = globalThis as unknown as {
  nexoraPrisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.nexoraPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.nexoraPrisma = prisma;
}
