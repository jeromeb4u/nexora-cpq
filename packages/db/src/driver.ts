/**
 * Which database driver a connection string needs.
 *
 * Kept apart from client.ts so it can be unit-tested: importing the client
 * module constructs a PrismaClient, which requires a live DATABASE_URL.
 */

export type DatabaseDriver = 'neon' | 'pg';

export function driverFor(connectionString: string): DatabaseDriver {
  try {
    const host = new URL(connectionString).hostname;
    return host === 'neon.tech' || host.endsWith('.neon.tech') ? 'neon' : 'pg';
  } catch {
    return 'pg';
  }
}
