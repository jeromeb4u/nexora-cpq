import { defineConfig, devices } from '@playwright/test';

import { e2eDatabaseUrl } from './e2e/support/database';

/**
 * End-to-end tests: both zones behind the microfrontends proxy, exactly as a
 * user reaches them, against a disposable PostgreSQL database.
 *
 * The servers are always started by Playwright (never reused) so that they are
 * guaranteed to be pointed at E2E_DATABASE_URL. Reusing a developer's running
 * servers could silently aim these mutating tests at the shared demo database.
 *
 * Prerequisites: `pnpm build` with the same environment, and a migrated
 * database at E2E_DATABASE_URL. See docs/TESTING.md.
 */

const databaseUrl = e2eDatabaseUrl();
const PUBLIC_ORIGIN = 'http://localhost:3024';

const serverEnv: Record<string, string> = {
  DATABASE_URL: databaseUrl,
  DIRECT_DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-not-used-anywhere-real',
  BETTER_AUTH_URL: PUBLIC_ORIGIN,
  AUTH_TRUSTED_ORIGINS: PUBLIC_ORIGIN,
  NEXT_PUBLIC_PLATFORM_URL: PUBLIC_ORIGIN,
  NEXT_PUBLIC_CPQ_URL: 'http://localhost:3001',
  EMAIL_PROVIDER: 'console',
  LOG_LEVEL: 'warn',
};

const script = process.env.E2E_SERVER_SCRIPT === 'dev' ? 'dev' : 'start';

export default defineConfig({
  testDir: './e2e',
  // Every test reseeds the one shared database, so tests must not overlap.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: PUBLIC_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // E2E_BROWSER_CHANNEL=chrome uses an installed Chrome instead of
        // Playwright's downloaded Chromium (CI installs Chromium).
        ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
      },
    },
  ],
  webServer: [
    {
      command: `pnpm --filter @nexora/platform ${script}`,
      url: 'http://localhost:3000/sign-in',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `pnpm --filter @nexora/cpq ${script}`,
      // Unauthenticated pages redirect to Platform's /sign-in, which does not
      // exist on this app's own port; this route answers 401 instead, which
      // Playwright treats as "up".
      url: 'http://localhost:3001/quotes/c000000000000000000000000/current-version',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @nexora/platform proxy',
      url: `${PUBLIC_ORIGIN}/sign-in`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
