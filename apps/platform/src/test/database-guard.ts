/**
 * Refuse to point mutating tests at anything but a disposable database.
 *
 * The live demo runs on Neon. Integration and end-to-end tests create, approve
 * and cancel quotes, so running them there would corrupt the showcase data the
 * README tells people to log in and look at.
 */
export function assertDisposableDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at a disposable PostgreSQL database (see docs/TESTING.md).',
    );
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid connection URL.');
  }

  if (host === 'neon.tech' || host.endsWith('.neon.tech')) {
    throw new Error(
      'Refusing to run mutating tests against a Neon database. Use a local or CI database.',
    );
  }

  return url;
}
