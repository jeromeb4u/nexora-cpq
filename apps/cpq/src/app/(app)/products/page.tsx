import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { productListQuerySchema } from '@nexora/validation';

import { requirePagePermission } from '@/lib/session';
import { getCategoryCounts, listProducts } from '@/lib/products';
import { ProductFilters } from '@/components/product-catalogue/product-filters';
import { ProductTable } from '@/components/product-catalogue/product-table';

export const metadata: Metadata = { title: 'Products' };

/**
 * The product catalogue: a read-only list of everything that can be sold.
 *
 * Filters live entirely in the URL, exactly like the quote list — a filtered
 * view is a link that can be bookmarked, shared with a colleague, or
 * reloaded without losing state. The query is parsed from `searchParams`
 * with the same Zod schema a future write path would use, rather than being
 * held in client state.
 *
 * Unparseable parameters fall back to defaults instead of erroring — a stale
 * or hand-edited URL should show the default list, not a crash.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(Permission.PRODUCT_READ);
  const raw = await searchParams;

  const parsed = productListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : productListQuerySchema.parse({});

  const [result, categoryCounts] = await Promise.all([listProducts(query), getCategoryCounts()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description={
          result.total === 1 ? '1 product' : `${result.total.toLocaleString('en-GB')} products`
        }
      />

      <ProductFilters categoryCounts={categoryCounts} />

      {result.total === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10">
          <EmptyState
            title="No products match these filters"
            description="Try clearing the search or widening the category and status filters."
            action={
              <Button asChild variant="secondary">
                <Link href="/products">Clear filters</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ProductTable
          rows={result.rows}
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
        />
      )}
    </div>
  );
}
