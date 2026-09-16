import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Seed data lives under prisma/, and its integrity is worth guarding in CI.
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
  },
});
