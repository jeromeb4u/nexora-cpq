import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      // Enabled by default so `pnpm test` enforces the thresholds below rather
      // than silently passing when someone forgets the --coverage flag.
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
      // The engines are the financially critical code in this system.
      // They are held to a higher bar than the UI.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
