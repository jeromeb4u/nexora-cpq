'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button, Input, Select } from '@nexora/ui';
import { CUSTOMER_STATUSES, INDUSTRIES, type CustomerStatus, type Industry } from '@nexora/types';

import { cn } from '../cn';
import { CUSTOMER_STATUS_LABELS, INDUSTRY_LABELS } from './labels';

export interface CustomerFiltersProps {
  readonly owners: readonly { readonly id: string; readonly name: string }[];
}

/**
 * Filter controls for the customer list.
 *
 * Every control writes to the URL rather than to component state, so the
 * server re-renders the filtered list and the view stays shareable — see
 * `apps/cpq/src/components/quote-filters.tsx`, which this mirrors. Search is
 * debounced because it fires a server round-trip on every keystroke otherwise.
 */
export function CustomerFilters({ owners }: CustomerFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const selectedStatuses = (searchParams.get('status') ?? '')
    .split(',')
    .filter(Boolean) as CustomerStatus[];
  const selectedIndustry = searchParams.get('industry') ?? '';
  const selectedOwner = searchParams.get('ownerId') ?? '';

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

  function toggleStatus(status: CustomerStatus) {
    apply((params) => {
      const next = selectedStatuses.includes(status)
        ? selectedStatuses.filter((candidate) => candidate !== status)
        : [...selectedStatuses, status];

      if (next.length > 0) params.set('status', next.join(','));
      else params.delete('status');
    });
  }

  const hasFilters =
    Boolean(search) || selectedStatuses.length > 0 || Boolean(selectedIndustry) || Boolean(selectedOwner);

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
            placeholder="Search by company, legal name, VAT number or email"
            aria-label="Search customers"
            className="pl-8"
          />
        </div>

        <Select
          value={selectedIndustry}
          aria-label="Filter by industry"
          onChange={(event) => {
            const value = event.target.value;
            apply((params) => {
              if (value) params.set('industry', value);
              else params.delete('industry');
            });
          }}
          className="sm:w-48"
        >
          <option value="">All industries</option>
          {INDUSTRIES.map((industry: Industry) => (
            <option key={industry} value={industry}>
              {INDUSTRY_LABELS[industry]}
            </option>
          ))}
        </Select>

        <Select
          value={selectedOwner}
          aria-label="Filter by account owner"
          onChange={(event) => {
            const value = event.target.value;
            apply((params) => {
              if (value) params.set('ownerId', value);
              else params.delete('ownerId');
            });
          }}
          className="sm:w-48"
        >
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>

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
        <legend className="sr-only">Filter by status</legend>
        {CUSTOMER_STATUSES.map((status: CustomerStatus) => {
          const active = selectedStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                active
                  ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] text-[var(--text-link)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {CUSTOMER_STATUS_LABELS[status]}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
