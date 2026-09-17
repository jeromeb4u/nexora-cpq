import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';
import { bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';

import { requireSession } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { getDashboardMetrics, getRecentActivity, getRecentQuotes } from '@/lib/dashboard';
import { MetricTile } from '@/components/metric-tile';
import { RelativeTime } from '@/components/relative-time';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const actor = await requireSession();

  const now = requestInstant();

  const [metrics, recentQuotes, activity] = await Promise.all([
    getDashboardMetrics(actor),
    getRecentQuotes(actor),
    getRecentActivity(actor),
  ]);

  const firstName = actor.name.split(' ')[0] ?? actor.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Your pipeline at a glance, and what needs attention today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Active quotes"
          value={String(metrics.activeQuotes)}
          hint="In draft, review, approval or issued"
        />
        <MetricTile
          label="Awaiting approval"
          value={String(metrics.awaitingApproval)}
          hint={metrics.awaitingApproval > 0 ? 'Needs a decision' : 'Nothing pending'}
          tone={metrics.awaitingApproval > 0 ? 'attention' : 'neutral'}
          href="/approvals"
        />
        <MetricTile
          label="Pipeline value"
          value={formatMoney(metrics.pipelineValue, { showCents: false })}
          hint={`${formatMoney(metrics.pipelineMrr, { showCents: false })} monthly recurring`}
        />
        <MetricTile
          label="Win rate"
          value={metrics.winRate === null ? '—' : formatRate(metrics.winRate, 0)}
          hint={
            metrics.concludedCount === 0
              ? 'No concluded quotes yet'
              : `${metrics.wonCount} of ${metrics.concludedCount} concluded`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent quotes</CardTitle>
            <Link
              href="/quotes"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-link)] hover:underline"
            >
              All quotes
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentQuotes.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No quotes yet"
                  description="Quotes you create or that are shared with you will appear here."
                  action={
                    <Link
                      href="/quotes/new"
                      className="text-sm font-medium text-[var(--text-link)] hover:underline"
                    >
                      Create your first quote
                    </Link>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        {/* Cross-zone: the CPQ app owns /quotes. */}
                        <a
                          href={`/quotes/${quote.id}`}
                          className="font-medium text-[var(--text-link)] hover:underline"
                        >
                          {quote.quoteNumber}
                        </a>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {quote.customer.companyName}
                      </TableCell>
                      <TableCellNumeric>
                        {quote.currentVersion
                          ? formatMoney(cents(quote.currentVersion.mrrCents))
                          : '—'}
                      </TableCellNumeric>
                      <TableCellNumeric>
                        {quote.currentVersion && quote.currentVersion.discountBps > 0
                          ? formatRate(bpsToRate(quote.currentVersion.discountBps))
                          : '—'}
                      </TableCellNumeric>
                      <TableCell>
                        <StatusBadge status={quote.status} />
                      </TableCell>
                      <TableCell className="text-[var(--text-tertiary)]">
                        <RelativeTime date={quote.updatedAt} now={now} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState
                title="Nothing yet"
                description="Actions you and your team take will be recorded here."
              />
            ) : (
              <ol className="space-y-3">
                {activity.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--border-strong)]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug text-[var(--text-primary)]">
                        {event.summary}
                      </p>
                      <p className="text-2xs mt-0.5 text-[var(--text-tertiary)]">
                        {event.actor?.name ?? 'System'} ·{' '}
                        <RelativeTime date={event.createdAt} now={now} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
