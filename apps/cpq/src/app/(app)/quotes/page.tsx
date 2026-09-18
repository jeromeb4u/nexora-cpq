import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { quoteListQuerySchema } from '@nexora/validation';

import { requirePagePermission } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { listQuotes, listVisibleOwners } from '@/lib/quotes';
import { QuoteFilters } from '@/components/quote-filters';
import { QuoteTable } from '@/components/quote-table';

export const metadata: Metadata = { title: 'Quotes' };

/**
 * The quote list.
 *
 * Filters live entirely in the URL: a filtered view is a link that can be
 * bookmarked, shared with a colleague, or reloaded without losing state. That
 * is why the query is parsed from `searchParams` with the same Zod schema the
 * server action uses, rather than being held in client state.
 *
 * Unparseable parameters fall back to defaults instead of erroring — a stale
 * or hand-edited URL should show the default list, not a crash.
 */
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePagePermission(Permission.QUOTE_READ_OWN);
  const raw = await searchParams;

  const parsed = quoteListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : quoteListQuerySchema.parse({});

  const now = requestInstant();

  const [result, owners] = await Promise.all([listQuotes(actor, query), listVisibleOwners(actor)]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotes"
        description={
          result.total === 1 ? '1 quote' : `${result.total.toLocaleString('en-GB')} quotes`
        }
        actions={
          <Button asChild>
            <Link href="/quotes/new">
              <Plus className="size-4" aria-hidden />
              New quote
            </Link>
          </Button>
        }
      />

      <QuoteFilters owners={owners} currentOwnerId={actor.id} />

      {result.total === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10">
          <EmptyState
            title="No quotes match these filters"
            description="Try clearing the search or widening the status filter. New quotes you create will appear here."
            action={
              <Button asChild variant="secondary">
                <Link href="/quotes">Clear filters</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <QuoteTable
          rows={result.rows}
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          now={now}
        />
      )}
    </div>
  );
}
