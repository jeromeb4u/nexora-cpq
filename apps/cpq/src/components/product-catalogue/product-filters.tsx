'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button, Input, cn } from '@nexora/ui';
import { type ProductCategory } from '@nexora/types';

import { CATEGORY_LABELS } from './labels';

export interface ProductFiltersProps {
  readonly categoryCounts: readonly {
    readonly category: ProductCategory;
    readonly count: number;
  }[];
}

type StatusFilter = 'all' | 'active' | 'withdrawn';

const STATUS_OPTIONS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/**
 * Filter controls for the product catalogue.
 *
 * Every control writes to the URL rather than to component state, so the
 * server re-renders the filtered list and the view stays shareable — the
 * same approach `QuoteFilters` uses for the quote list. Search is debounced
 * because it fires a server round-trip on every keystroke otherwise.
 */
export function ProductFilters({ categoryCounts }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const selectedCategories = (searchParams.get('category') ?? '')
    .split(',')
    .filter(Boolean) as ProductCategory[];

  const isActiveParam = searchParams.get('isActive');
  const statusFilter: StatusFilter =
    isActiveParam === 'true' ? 'active' : isActiveParam === 'false' ? 'withdrawn' : 'all';

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // Any filter change invalidates the current page offset.
      params.delete('page');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce the search box: one request when typing settles, not per keystroke.
  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (search === current) return;

    const timer = setTimeout(() => {
      apply((params) => {
        if (search) params.set('search', search);
        else params.delete('search');
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchParams, apply]);

  function toggleCategory(category: ProductCategory) {
    apply((params) => {
      const next = selectedCategories.includes(category)
        ? selectedCategories.filter((candidate) => candidate !== category)
        : [...selectedCategories, category];

      if (next.length > 0) params.set('category', next.join(','));
      else params.delete('category');
    });
  }

  function setStatusFilter(next: StatusFilter) {
    apply((params) => {
      if (next === 'active') params.set('isActive', 'true');
      else if (next === 'withdrawn') params.set('isActive', 'false');
      else params.delete('isActive');
    });
  }

  const hasFilters = Boolean(search) || selectedCategories.length > 0 || statusFilter !== 'all';

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3',
        isPending && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by SKU, name or description"
            aria-label="Search products"
            className="pl-8"
          />
        </div>

        <fieldset className="flex gap-1">
          <legend className="sr-only">Filter by status</legend>
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                aria-pressed={active}
                className={cn(
                  'text-2xs rounded-sm border px-2.5 py-1 font-medium transition-colors',
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] text-[var(--text-link)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>

        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() =>
              startTransition(() => {
                router.replace(pathname, { scroll: false });
              })
            }
          >
            <X className="size-4" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Filter by category</legend>
        {categoryCounts.map(({ category, count }) => {
          const active = selectedCategories.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              aria-pressed={active}
              className={cn(
                'text-2xs rounded-full border px-2.5 py-1 font-medium transition-colors',
                active
                  ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] text-[var(--text-link)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {CATEGORY_LABELS[category]}
              <span className="tabular ml-1 text-[var(--text-tertiary)]">{count}</span>
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
