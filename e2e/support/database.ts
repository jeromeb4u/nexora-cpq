import { execSync } from 'node:child_process';

/**
 * The database the end-to-end run is allowed to touch.
 *
 * Refuses a missing URL and any Neon host: the live demo runs on Neon, and
 * these tests create, approve and cancel quotes.
 */
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL is not set. Point it at a disposable PostgreSQL database (docs/TESTING.md).',
    );
  }
  const host = new URL(url).hostname;
  if (host === 'neon.tech' || host.endsWith('.neon.tech')) {
    throw new Error('Refusing to run end-to-end tests against a Neon database.');
  }
  return url;
}

/** Restore the deterministic demo data set, so each test starts from the same state. */
export function reseed(): void {
  const url = e2eDatabaseUrl();
  execSync('pnpm --filter @nexora/db seed', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  });
}
