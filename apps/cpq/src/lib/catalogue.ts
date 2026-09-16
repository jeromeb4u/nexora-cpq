import 'server-only';

import { cache } from 'react';
import { prisma, toConfigurationRule, toProductSnapshot } from '@nexora/db';
import type { ConfigurationRule, ProductSnapshot } from '@nexora/types';

/**
 * Catalogue loading for the CPQ engines.
 *
 * Wrapped in React's `cache` so that a single request which validates, prices
 * and re-validates a configuration loads the catalogue once rather than three
 * times. The cache is per-request, so a price is never computed against a
 * catalogue snapshot from an earlier request.
 */

export const loadCatalogue = cache(async (): Promise<readonly ProductSnapshot[]> => {
  const products = await prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
  return products.map(toProductSnapshot);
});

export const loadRules = cache(async (): Promise<readonly ConfigurationRule[]> => {
  const rules = await prisma.productRule.findMany({
    where: { isActive: true },
    include: { targets: true },
  });
  return rules.map(toConfigurationRule);
});

/**
 * Only products that can still be sold.
 *
 * The configurator offers these; the full catalogue is still used for pricing
 * and validation, because an existing draft may reference a withdrawn product
 * that must be surfaced as an error rather than silently vanishing.
 */
export const loadSellableCatalogue = cache(async (): Promise<readonly ProductSnapshot[]> => {
  const catalogue = await loadCatalogue();
  return catalogue.filter((product) => product.isActive);
});

/** Look up the snapshots for a specific set of product ids. */
export async function snapshotsFor(
  productIds: readonly string[],
): Promise<readonly ProductSnapshot[]> {
  const catalogue = await loadCatalogue();
  const wanted = new Set(productIds);
  return catalogue.filter((product) => wanted.has(product.id));
}
