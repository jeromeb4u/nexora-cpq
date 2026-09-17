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

export interface PgPoolOptions {
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
}

/**
 * Optional node-postgres pool tuning from the environment.
 *
 * Unset in every real deployment. It exists for `prisma dev`, the Docker-free
 * local database, which serves one connection at a time: when two apps and a
 * test runner each keep idle pooled connections, it drops the older ones.
 * `PG_POOL_MAX=1` and `PG_POOL_IDLE_TIMEOUT_MS=1` make each process hold at most
 * one connection and release it straight away. Invalid values are ignored.
 */
export function pgPoolOptions(env: { readonly [key: string]: string | undefined }): PgPoolOptions {
  const positiveInt = (raw: string | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  const max = positiveInt(env.PG_POOL_MAX);
  const idleTimeoutMillis = positiveInt(env.PG_POOL_IDLE_TIMEOUT_MS);
  return {
    ...(max === undefined ? {} : { max }),
    ...(idleTimeoutMillis === undefined ? {} : { idleTimeoutMillis }),
  };
}
