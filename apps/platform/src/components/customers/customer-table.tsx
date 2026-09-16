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
import type { CustomerStatus, Industry } from '@nexora/types';

import { cn } from '../cn';
import { RelativeTime } from '../relative-time';
import { INDUSTRY_LABELS } from './labels';

export interface CustomerRow {
  readonly id: string;
  readonly companyName: string;
  readonly industry: Industry;
  readonly status: CustomerStatus;
  readonly updatedAt: Date;
  readonly accountOwner: { readonly id: string; readonly name: string };
  readonly _count: { readonly locations: number; readonly quotes: number };
}

export interface CustomerTableProps {
  readonly rows: readonly CustomerRow[];
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
  readonly sortBy: string;
  readonly sortDir: 'asc' | 'desc';
  /** Epoch ms captured once by the page, so every row measures from one instant. */
  readonly now: number;
}

type SortableColumn = 'companyName' | 'status' | 'updatedAt';

/**
 * A sortable column header.
 *
 * Declared at module scope rather than inside `CustomerTable`. A component
 * defined during render is a new component type on every render, so React
 * unmounts and remounts its subtree instead of updating it — losing focus and
 * any internal state. The `react-hooks/static-components` rule catches
 * exactly this. Mirrors `apps/cpq/src/components/quote-table.tsx`.
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

export function CustomerTable({
  rows,
  page,
  pageCount,
  total,
  pageSize,
  sortBy,
  sortDir,
  now,
}: CustomerTableProps) {
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
        // Text ascends, dates descend — the useful default differs.
        params.set('sortDir', column === 'companyName' ? 'asc' : 'desc');
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
              <SortHeader column="companyName" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort}>
                Company
              </SortHeader>
              <TableHead>Industry</TableHead>
              <SortHeader column="status" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort}>
                Status
              </SortHeader>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
              <TableHead>Account owner</TableHead>
              <SortHeader column="updatedAt" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort}>
                Updated
              </SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/customers/${row.id}`}
                    className="font-medium text-[var(--text-link)] hover:underline"
                  >
                    {row.companyName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-40 truncate text-[var(--text-secondary)]">
                  {INDUSTRY_LABELS[row.industry]}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCellNumeric>{row._count.locations}</TableCellNumeric>
                <TableCellNumeric>{row._count.quotes}</TableCellNumeric>
                <TableCell className="max-w-36 truncate text-[var(--text-secondary)]">
                  {row.accountOwner.name}
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
