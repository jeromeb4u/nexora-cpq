import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
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

import { RelativeTime } from '../relative-time';

export interface CustomerQuoteRow {
  readonly id: string;
  readonly quoteNumber: string;
  readonly status: QuoteStatus;
  readonly updatedAt: Date;
  readonly owner: { readonly id: string; readonly name: string };
  readonly currentVersion: {
    readonly mrrCents: number;
    readonly contractMonths: number;
    readonly discountBps: number;
  } | null;
}

export interface QuotesSectionProps {
  readonly quotes: readonly CustomerQuoteRow[];
  /** Epoch ms captured once by the page, so every row measures from one instant. */
  readonly now: number;
}

/**
 * Quotes raised against this customer, newest first.
 *
 * `/quotes/:id` is owned by the CPQ micro frontend, not this one — the quote
 * number is a plain `<a>` rather than `next/link` so the browser performs a
 * real navigation instead of asking this app's router for a route it does
 * not have (see `apps/platform/src/app/(app)/dashboard/page.tsx`).
 */
export function QuotesSection({ quotes, now }: QuotesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes</CardTitle>
      </CardHeader>
      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Quotes raised for this customer will appear here."
        />
      ) : (
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <a
                      href={`/quotes/${quote.id}`}
                      className="font-medium text-[var(--text-link)] hover:underline"
                    >
                      {quote.quoteNumber}
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={quote.status} />
                  </TableCell>
                  <TableCellNumeric>
                    {quote.currentVersion ? formatMoney(cents(quote.currentVersion.mrrCents)) : '—'}
                  </TableCellNumeric>
                  <TableCellNumeric className="text-[var(--text-secondary)]">
                    {quote.currentVersion ? `${quote.currentVersion.contractMonths} mo` : '—'}
                  </TableCellNumeric>
                  <TableCellNumeric>
                    {quote.currentVersion && quote.currentVersion.discountBps > 0
                      ? formatRate(bpsToRate(quote.currentVersion.discountBps))
                      : '—'}
                  </TableCellNumeric>
                  <TableCell className="max-w-36 truncate text-[var(--text-secondary)]">
                    {quote.owner.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--text-tertiary)]">
                    <RelativeTime date={quote.updatedAt} now={now} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
