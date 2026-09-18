import 'server-only';

import { prisma } from '@nexora/db';
import type { Prisma } from '@nexora/db';
import { ProductCategory } from '@nexora/types';
import type { ProductListQueryInput } from '@nexora/validation';

/**
 * Product catalogue queries.
 *
 * Unlike quotes, products are not scoped to an actor — the catalogue is a
 * shared, global list every permitted user sees in full. Visibility is
 * therefore governed entirely by the page-level permission check
 * (`Permission.PRODUCT_READ`), not by a per-row WHERE clause.
 */

export interface ProductListResult {
  readonly rows: Awaited<ReturnType<typeof findProducts>>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

function buildWhere(query: ProductListQueryInput): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (query.search) {
    // SKU, name and description cover how people actually look a product up:
    // by reference code, by commercial name, or by what it does.
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.category.length > 0) {
    where.category = { in: query.category };
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  return where;
}

async function findProducts(where: Prisma.ProductWhereInput, query: ProductListQueryInput) {
  return prisma.product.findMany({
    where,
    // Category groups the list into recognisable sections, sortOrder is the
    // curated order within a category, and name is the final tiebreaker.
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      monthlyPriceCents: true,
      setupPriceCents: true,
      pricingModel: true,
      minContractMonths: true,
      maxDiscountBps: true,
      bandwidthMbps: true,
      isActive: true,
      _count: {
        select: {
          // How many compatibility rules this product participates in,
          // either as the trigger or as the effect — a proxy for how
          // constrained the product is within the configuration engine.
          triggerRules: true,
          effectRules: true,
        },
      },
    },
  });
}

export async function listProducts(query: ProductListQueryInput): Promise<ProductListResult> {
  const where = buildWhere(query);

  const [rows, total] = await Promise.all([
    findProducts(where, query),
    prisma.product.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export interface CategoryCount {
  readonly category: ProductCategory;
  readonly count: number;
}

/**
 * Count of active products per category, for the filter chips.
 *
 * Withdrawn products are excluded from the counts shown alongside each chip:
 * the chip communicates "how much of the live catalogue is in this
 * category", not a raw row count including discontinued items.
 */
export async function getCategoryCounts(): Promise<readonly CategoryCount[]> {
  const grouped = await prisma.product.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: { _all: true },
  });

  const countByCategory = new Map(grouped.map((row) => [row.category, row._count._all]));

  // Every category appears, even at zero, so the chip row has a stable shape
  // regardless of which categories currently have active products.
  return Object.values(ProductCategory).map((category) => ({
    category,
    count: countByCategory.get(category) ?? 0,
  }));
}
