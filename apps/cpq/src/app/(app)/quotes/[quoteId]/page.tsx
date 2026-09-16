import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Breadcrumbs, PageHeader, StatusBadge } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { getQuoteAudit, getQuoteDetail } from '@/lib/quotes';
import { requestInstant } from '@/lib/now';
import { PricingSummary } from '@/components/quote-detail/pricing-summary';
import { LineItemsTable } from '@/components/quote-detail/line-items-table';
import { VersionHistoryTable } from '@/components/quote-detail/version-history-table';
import { ApprovalsList } from '@/components/quote-detail/approvals-list';
import { AuditTimeline } from '@/components/quote-detail/audit-timeline';

interface QuotePageParams {
  readonly quoteId: string;
}

/**
 * Shared, per-request-deduplicated fetch of the quote.
 *
 * `generateMetadata` and the page component each need this quote, and
 * `React.cache` collapses them into one `getQuoteDetail` call per request
 * instead of two. Not-found is translated to Next's `notFound()` here so
 * both call sites get the same 404 behaviour for free.
 */
const loadQuote = cache(async (quoteId: string) => {
  const actor = await requirePagePermission(Permission.QUOTE_READ_OWN);

  try {
    return await getQuoteDetail(actor, quoteId);
  } catch (error) {
    if (isAppError(error, ErrorCode.NOT_FOUND)) {
      notFound();
    }
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<QuotePageParams>;
}): Promise<Metadata> {
  const { quoteId } = await params;
  const { quote } = await loadQuote(quoteId);
  return { title: quote.quoteNumber };
}

/**
 * Read-only quote detail: pricing, line items, version history, approvals,
 * and the audit trail. Nothing on this page mutates data.
 */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<QuotePageParams>;
}) {
  const { quoteId } = await params;
  const { quote } = await loadQuote(quoteId);
  const auditEvents = await getQuoteAudit(quote.id);

  const now = requestInstant();

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Quotes', href: '/quotes' }, { label: quote.quoteNumber }]} />

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {quote.quoteNumber}
            <StatusBadge status={quote.status} />
          </span>
        }
        description={
          quote.location
            ? `${quote.customer.companyName} · ${quote.location.name}`
            : quote.customer.companyName
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 flex flex-col gap-5 xl:order-1">
          <LineItemsTable items={quote.currentVersion?.items ?? []} />
          <VersionHistoryTable versions={quote.versions} now={now} />
          <ApprovalsList approvals={quote.approvals} now={now} />
          <AuditTimeline events={auditEvents} now={now} />
        </div>

        <div className="order-1 xl:order-2 xl:sticky xl:top-4 xl:self-start">
          <PricingSummary version={quote.currentVersion} />
        </div>
      </div>
    </div>
  );
}
