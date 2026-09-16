/**
 * Database package public surface.
 *
 * Consumers import the client, the generated model types and the generated
 * enums from here and nowhere else. The generated directory is an
 * implementation detail; the `no-restricted-imports` ESLint rule blocks deep
 * imports into it so the Prisma output path can change without touching call
 * sites.
 */

export { prisma } from './client';

// Prisma 7 re-exports model types (`Customer`, `Quote`, …), the generated
// enums, and the `Prisma` namespace from the client entrypoint.
export * from './generated/prisma/client';
