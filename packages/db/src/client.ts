import 'server-only';

import { PrismaNeon } from '@prisma/adapter-neon';

import { PrismaClient } from './generated/prisma/client';

/**
 * The Prisma client singleton.
 *
 * `server-only` is imported at the top so that any accidental import of this
 * module from a Client Component fails the build rather than shipping database
 * credentials to the browser. That guarantee is worth more than the one line
 * it costs.
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
