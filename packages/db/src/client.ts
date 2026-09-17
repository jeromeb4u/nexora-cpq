import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';
import { driverFor } from './driver';

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
 * Driver selection:
 *   - A Neon host uses the Neon serverless driver. On Vercel each request may
 *     land in a fresh isolate, and Neon's driver connects over WebSockets/HTTP
 *     through Neon's pooler instead of holding raw TCP connections that would
 *     exhaust Postgres' connection limit.
 *   - Any other host uses node-postgres. Neon's driver cannot speak to an
 *     ordinary Postgres server — it needs Neon's WebSocket proxy — so without
 *     this branch the application would silently require Neon, and CI's
 *     Postgres service container (or a developer's local Postgres) would not
 *     work at all.
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

  const adapter =
    driverFor(connectionString) === 'neon'
      ? new PrismaNeon({ connectionString })
      : new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
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
