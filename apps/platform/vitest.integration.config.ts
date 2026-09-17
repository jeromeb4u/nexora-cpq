import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

import { assertDisposableDatabase } from './src/test/database-guard';

/**
 * Integration tests: services against a real PostgreSQL database.
 *
 * They mutate data, so they only ever run against a disposable database named
 * by TEST_DATABASE_URL — never the shared demo. The guard below refuses a
 * missing URL and any Neon host outright, before a single test is collected.
 */
const databaseUrl = assertDisposableDatabase(process.env.TEST_DATABASE_URL);

export default defineConfig({
  // tsconfig says jsx: preserve because Next compiles JSX itself; tests must
  // transform it here instead.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Components bundle. The
      // services are server code; in a Node test process that guard has
      // nothing to protect.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // One shared database: files run one at a time so they cannot interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: 'integration-tests-only-not-a-real-secret',
      NEXT_PUBLIC_PLATFORM_URL: 'http://localhost:3024',
      EMAIL_PROVIDER: 'console',
      LOG_LEVEL: 'error',
    },
  },
});
