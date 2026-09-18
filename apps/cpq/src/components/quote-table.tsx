'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Pagination,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';
import { type QuoteStatus, bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';

import { cn } from './cn';
import { RelativeTime } from './relative-time';

export interface QuoteRow {
  readonly id: string;
  readonly quoteNumber: string;
  readonly status: QuoteStatus;
  readonly title: string | null;
  readonly updatedAt: Date;
  readonly customer: { readonly id: string; readonly companyName: string };
  readonly owner: { readonly id: string; readonly name: string };
  readonly currentVersion: {
    readonly mrrCents: number;
    readonly tcvCents: number;
    readonly contractMonths: number;
    readonly discountBps: number;
    readonly versionNumber: number;
  } | null;
}

export interface QuoteTableProps {
  readonly rows: readonly QuoteRow[];
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
  readonly sortBy: string;
  readonly sortDir: 'asc' | 'desc';
  /** Epoch ms captured once by the page, so every row measures from one instant. */
  readonly now: number;
}

type SortableColumn = 'quoteNumber' | 'mrrCents' | 'status' | 'updatedAt';

/**
 * A sortable column header.
 *
 * Declared at module scope rather than inside `QuoteTable`. A component defined
 * during render is a new component type on every render, so React unmounts and
 * remounts its subtree instead of updating it — losing focus and any internal
 * state. The `react-hooks/static-components` rule catches exactly this.
 */
function SortHeader({
  column,
  children,
  align = 'left',
  sortBy,
  sortDir,
  onToggle,
}: {
  readonly column: SortableColumn;
  readonly children: React.ReactNode;
  readonly align?: 'left' | 'right';
  readonly sortBy: string;
  readonly sortDir: 'asc' | 'desc';
  readonly onToggle: (column: SortableColumn) => void;
}) {
  const active = sortBy === column;
  const Icon = !active ? ChevronsUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={align === 'right' ? 'text-right' : undefined}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)]',
          align === 'right' && 'flex-row-reverse',
          active && 'text-[var(--text-primary)]',
        )}
      >
        {children}
        <Icon className="size-3 shrink-0 opacity-60" aria-hidden />
      </button>
    </TableHead>
  );
}

export function QuoteTable({
  rows,
  page,
  pageCount,
  total,
  pageSize,
  sortBy,
  sortDir,
  now,
}: QuoteTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSort(column: SortableColumn) {
    setParam((params) => {
      if (sortBy === column) {
        params.set('sortDir', sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        params.set('sortBy', column);
        // Text ascends, money and dates descend — the useful default differs.
        params.set('sortDir', column === 'quoteNumber' ? 'asc' : 'desc');
      }
      params.delete('page');
    });
  }

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader
                column="quoteNumber"
                sortBy={sortBy}
                sortDir={sortDir}
                onToggle={toggleSort}
              >
                Quote
              </SortHeader>
              <TableHead>Customer</TableHead>
              <TableHead>Owner</TableHead>
              <SortHeader
                column="mrrCents"
                align="right"
                sortBy={sortBy}
                sortDir={sortDir}
                onToggle={toggleSort}
              >
                MRR
              </SortHeader>
              <TableHead className="text-right">Contract</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <SortHeader column="status" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort}>
                Status
              </SortHeader>
              <SortHeader
                column="updatedAt"
                sortBy={sortBy}
                sortDir={sortDir}
                onToggle={toggleSort}
              >
                Updated
              </SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/quotes/${row.id}`}
                    className="font-medium text-[var(--text-link)] hover:underline"
                  >
                    {row.quoteNumber}
                  </Link>
                  {row.title ? (
                    <span className="text-2xs block max-w-56 truncate text-[var(--text-tertiary)]">
                      {row.title}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-44 truncate">{row.customer.companyName}</TableCell>
                <TableCell className="max-w-36 truncate text-[var(--text-secondary)]">
                  {row.owner.name}
                </TableCell>
                <TableCellNumeric>
                  {row.currentVersion ? formatMoney(cents(row.currentVersion.mrrCents)) : '—'}
                </TableCellNumeric>
                <TableCellNumeric className="text-[var(--text-secondary)]">
                  {row.currentVersion ? `${row.currentVersion.contractMonths} mo` : '—'}
                </TableCellNumeric>
                <TableCellNumeric>
                  {row.currentVersion && row.currentVersion.discountBps > 0
                    ? formatRate(bpsToRate(row.currentVersion.discountBps))
                    : '—'}
                </TableCellNumeric>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-[var(--text-tertiary)]">
                  <RelativeTime date={row.updatedAt} now={now} />
                </TableCell>
              </TableRow>
            ))}
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
