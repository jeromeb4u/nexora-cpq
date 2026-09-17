import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig says jsx: preserve because Next compiles JSX itself; tests must
  // transform it here instead.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Components bundle; unit
      // tests of server modules run in plain Node.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Integration tests need a real database; they run from
    // vitest.integration.config.ts via `pnpm test:integration`.
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
  },
});
