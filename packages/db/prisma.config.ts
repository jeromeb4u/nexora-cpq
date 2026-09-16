import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Environment: this is a monorepo with ONE `.env` at the repository root, so
 * every workspace package sees the same connection strings. The Prisma CLI runs
 * with `packages/db` as its working directory, so the root file has to be
 * resolved explicitly rather than relying on dotenv's cwd lookup.
 *
 * Connection: migrations must run over a DIRECT (unpooled) connection — a
 * PgBouncer-style pooler cannot hold the advisory locks and prepared statements
 * Prisma Migrate depends on. The application runtime uses the pooled URL
 * instead, through the driver adapter in src/client.ts.
 */
const packageDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(packageDir, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },
});
