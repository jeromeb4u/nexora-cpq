import 'server-only';

import { prisma } from '@nexora/db';

/**
 * Configuration rule queries for the administration screens.
 *
 * The configurator loads rules through `lib/catalogue.ts`, projected onto the
 * engine's domain types. These queries are for *editing* rules, so they keep
 * the row shape and resolve the product names a person needs to read them.
 */

/** Products a rule may point at, in the order the catalogue lists them. */
export async function listProductOptions() {
  return prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, sku: true, name: true, category: true, isActive: true },
  });
}

export async function listRules() {
  const [rules, products] = await Promise.all([
    prisma.productRule.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'asc' }],
      include: { targets: { select: { productId: true } } },
    }),
    listProductOptions(),
  ]);

  const nameOf = new Map(products.map((product) => [product.id, product.name]));

  return rules.map((rule) => ({
    ...rule,
    triggerProductName: rule.triggerProductId ? (nameOf.get(rule.triggerProductId) ?? null) : null,
    effectProductName: rule.effectProductId ? (nameOf.get(rule.effectProductId) ?? null) : null,
    targetProductNames: rule.targets.flatMap((target) => {
      const name = nameOf.get(target.productId);
      return name ? [name] : [];
    }),
  }));
}

export async function getRule(ruleId: string) {
  return prisma.productRule.findUnique({
    where: { id: ruleId },
    include: { targets: { select: { productId: true } } },
  });
}

export async function getProduct(productId: string) {
  return prisma.product.findUnique({ where: { id: productId } });
}
