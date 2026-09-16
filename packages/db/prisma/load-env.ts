import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

/**
 * Loads the repository-root `.env` before anything else runs.
 *
 * This exists as its own module because ES modules hoist imports: a
 * `loadEnv()` call written at the top of seed.ts would still execute AFTER
 * `import { prisma } from '../src/client'` had already been evaluated — and
 * that module reads DATABASE_URL at construction time. Importing this file
 * first guarantees the environment is populated before any other module body
 * runs, because ESM evaluates imported modules in source order.
 */
const packageDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(packageDir, '../../../.env'), quiet: true });
