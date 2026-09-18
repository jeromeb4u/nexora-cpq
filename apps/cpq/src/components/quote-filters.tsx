'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button, Input, Select } from '@nexora/ui';
import { QUOTE_STATUSES, type QuoteStatus } from '@nexora/types';

import { cn } from './cn';

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  CONFIGURING: 'Configuring',
  READY_FOR_REVIEW: 'Ready for review',
  APPROVAL_REQUIRED: 'Approval required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SENT_TO_CUSTOMER: 'Sent to customer',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export interface QuoteFiltersProps {
  readonly owners: readonly { readonly id: string; readonly name: string }[];
  readonly currentOwnerId: string;
}

/**
 * Filter controls for the quote list.
 *
 * Every control writes to the URL rather than to component state, so the
 * server re-renders the filtered list and the view stays shareable. Search is
 * debounced because it fires a server round-trip on every keystroke otherwise.
 */
export function QuoteFilters({ owners, currentOwnerId }: QuoteFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const selectedStatuses = (searchParams.get('status') ?? '')
    .split(',')
    .filter(Boolean) as QuoteStatus[];
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

  function toggleStatus(status: QuoteStatus) {
    apply((params) => {
      const next = selectedStatuses.includes(status)
        ? selectedStatuses.filter((candidate) => candidate !== status)
        : [...selectedStatuses, status];

      if (next.length > 0) params.set('status', next.join(','));
      else params.delete('status');
    });
  }

  const hasFilters = Boolean(search) || selectedStatuses.length > 0 || Boolean(selectedOwner);

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
            placeholder="Search by quote number, title or customer"
            aria-label="Search quotes"
            className="pl-8"
          />
        </div>

        <Select
          value={selectedOwner}
          aria-label="Filter by owner"
          onChange={(event) => {
            const value = event.target.value;
            apply((params) => {
              if (value) params.set('ownerId', value);
              else params.delete('ownerId');
            });
          }}
          className="sm:w-52"
        >
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.id === currentOwnerId ? `${owner.name} (me)` : owner.name}
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
        {QUOTE_STATUSES.map((status) => {
          const active = selectedStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              aria-pressed={active}
              className={cn(
                'text-2xs rounded-full border px-2.5 py-1 font-medium transition-colors',
                active
                  ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] text-[var(--text-link)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
