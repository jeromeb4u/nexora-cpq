'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';
import {
  type PricingModel,
  type ProductCategory,
  bpsToRate,
  cents,
  formatMoney,
  formatRate,
} from '@nexora/types';

import { CATEGORY_LABELS, formatBandwidth, PRICING_MODEL_LABELS } from './labels';
import { ProductRowActions } from './product-row-actions';

export interface ProductRow {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly monthlyPriceCents: number;
  readonly setupPriceCents: number;
  readonly pricingModel: PricingModel;
  readonly minContractMonths: number;
  readonly maxDiscountBps: number;
  readonly bandwidthMbps: number | null;
  readonly isActive: boolean;
  readonly _count: {
    readonly triggerRules: number;
    readonly effectRules: number;
  };
}

export interface ProductTableProps {
  readonly rows: readonly ProductRow[];
  /** Whether the viewer may edit the catalogue; the server re-checks anyway. */
  readonly canManage: boolean;
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
}

/**
 * The product catalogue table. There is no column sort — `productListQuerySchema`
 * carries no `sortBy`, so the list is always presented in the curated
 * category / sortOrder / name order queried by `listProducts`.
 */
export function ProductTable({
  rows,
  canManage,
  page,
  pageCount,
  total,
  pageSize,
}: ProductTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Monthly price</TableHead>
              <TableHead className="text-right">Setup price</TableHead>
              <TableHead>Pricing model</TableHead>
              <TableHead className="text-right">Min term</TableHead>
              <TableHead className="text-right">Max discount</TableHead>
              <TableHead className="text-right">Rules</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? (
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const ruleCount = row._count.triggerRules + row._count.effectRules;

              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-medium">{row.sku}</TableCell>
                  <TableCell className="max-w-64">
                    <span className="block truncate">{row.name}</span>
                    {row.bandwidthMbps !== null ? (
                      <span className="text-2xs block text-[var(--text-tertiary)]">
                        {formatBandwidth(row.bandwidthMbps)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--text-secondary)]">
                    {CATEGORY_LABELS[row.category]}
                  </TableCell>
                  <TableCellNumeric>{formatMoney(cents(row.monthlyPriceCents))}</TableCellNumeric>
                  <TableCellNumeric>{formatMoney(cents(row.setupPriceCents))}</TableCellNumeric>
                  <TableCell className="whitespace-nowrap text-[var(--text-secondary)]">
                    {PRICING_MODEL_LABELS[row.pricingModel]}
                  </TableCell>
                  <TableCellNumeric className="text-[var(--text-secondary)]">
                    {row.minContractMonths} mo
                  </TableCellNumeric>
                  <TableCellNumeric>{formatRate(bpsToRate(row.maxDiscountBps))}</TableCellNumeric>
                  <TableCellNumeric className="text-[var(--text-secondary)]">
                    {ruleCount > 0 ? ruleCount : '—'}
                  </TableCellNumeric>
                  <TableCell>
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'Active' : 'Withdrawn'}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="whitespace-nowrap text-right">
                      <ProductRowActions productId={row.id} sku={row.sku} isActive={row.isActive} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="tabular text-2xs text-[var(--text-tertiary)]">
          Showing {firstRow}–{lastRow} of {total.toLocaleString('en-GB')}
        </p>
        {pageCount > 1 ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={(next) =>
              setParam((params) => {
                if (next <= 1) params.delete('page');
                else params.set('page', String(next));
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
