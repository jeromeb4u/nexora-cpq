import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import type { Role } from '@nexora/types';

/**
 * Lookups against the seeded test database.
 *
 * Tests resolve seeded rows by their stable natural keys (email, SKU, company
 * name) rather than hard-coding ids, because ids are generated at seed time.
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

export async function productIds(skus: readonly string[]): Promise<Map<string, string>> {
  const products = await prisma.product.findMany({
    where: { sku: { in: [...skus] } },
    select: { id: true, sku: true },
  });
  if (products.length !== skus.length) {
    throw new Error(`Seed is missing products: expected ${skus.join(', ')}`);
  }
  return new Map(products.map((product) => [product.sku, product.id]));
}

/** ACME GmbH and its Munich HQ — serviceable for 10G, owned by the sales rep. */
export async function acmeMunich() {
  const customer = await prisma.customer.findFirstOrThrow({
    where: { companyName: 'ACME GmbH' },
    include: { locations: true },
  });
  const location = customer.locations.find((candidate) => candidate.name === 'Munich HQ');
  if (!location) throw new Error('Seed is missing ACME Munich HQ');
  return { customer, location };
}

/** A location that belongs to some customer other than `customerId`. */
export async function foreignLocation(customerId: string) {
  return prisma.customerLocation.findFirstOrThrow({
    where: { customerId: { not: customerId } },
    select: { id: true },
  });
}

/** The ACME enterprise bundle from the flagship scenario (§46). */
export const ENTERPRISE_BUNDLE = [
  { sku: 'FIB-10G', quantity: 1 },
  { sku: 'SDW-ENT', quantity: 1 },
  { sku: 'HW-SDWAN-EDGE', quantity: 1 },
  { sku: 'SEC-FW', quantity: 1 },
  { sku: 'SEC-DDOS', quantity: 1 },
  { sku: 'SEC-SIG', quantity: 1 },
  { sku: 'HW-RTR-ENT', quantity: 2 },
  { sku: 'SUP-PREM', quantity: 1 },
] as const;

export async function bundleSelections() {
  const ids = await productIds(ENTERPRISE_BUNDLE.map((line) => line.sku));
  return ENTERPRISE_BUNDLE.map((line) => ({
    productId: ids.get(line.sku) ?? '',
    quantity: line.quantity,
  }));
}
