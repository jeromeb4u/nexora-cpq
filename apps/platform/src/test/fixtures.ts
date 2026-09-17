import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import type { Role } from '@nexora/types';

/**
 * Lookups against the seeded test database.
 *
 * Mirrors `apps/cpq/src/test/fixtures.ts`: tests resolve seeded rows by their
 * stable natural keys (email, company name) rather than hard-coding ids,
 * because ids are generated at seed time.
 */

export const USERS = {
  admin: 'admin@nexora.demo',
  pricingAdmin: 'pricing@nexora.demo',
  manager: 'salesmanager@nexora.demo',
  rep: 'sales@nexora.demo',
  otherRep: 'maria.lopez@nexora.demo',
} as const;

export async function actorFor(email: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  return { ...user, role: user.role as Role };
}

/** ACME GmbH, owned by the sales rep, with its seeded locations. */
export async function acmeGmbh() {
  return prisma.customer.findFirstOrThrow({
    where: { companyName: 'ACME GmbH' },
    include: { locations: true },
  });
}

/** A location that belongs to some customer other than `customerId`. */
export async function foreignLocation(customerId: string) {
  return prisma.customerLocation.findFirstOrThrow({
    where: { customerId: { not: customerId } },
    select: { id: true, customerId: true },
  });
}

/** A syntactically valid, freshly-unique VAT number for this test run. */
export function uniqueVatNumber(): string {
  // vatNumberSchema: 2 letters + 8-12 alphanumerics, uppercase.
  return `DE${Date.now().toString(36).toUpperCase().padStart(10, '0').slice(-10)}`;
}
