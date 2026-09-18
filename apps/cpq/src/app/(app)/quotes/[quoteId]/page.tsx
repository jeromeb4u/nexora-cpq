import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Breadcrumbs, PageHeader, StatusBadge } from '@nexora/ui';
import { Permission, canDecideApproval } from '@nexora/auth/permissions';
import { canTransition } from '@nexora/cpq-engine';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { getQuoteAudit, getQuoteDetail } from '@/lib/quotes';
import { requestInstant } from '@/lib/now';
import { quoteActionsFor } from '@/lib/quote-action-model';
import { QuoteActionBar } from '@/components/quote-detail/quote-action-bar';
import { DocumentGenerator } from '@/components/quote-detail/document-generator';
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
    return { actor, ...(await getQuoteDetail(actor, quoteId)) };
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
 * Quote detail: pricing, line items, version history, approvals, the audit
 * trail, and the lifecycle actions this viewer may take.
 *
 * Actions are derived from the state machine for display only; each one is
 * re-authorized by its server action.
 */
export default async function QuoteDetailPage({ params }: { params: Promise<QuotePageParams> }) {
  const { quoteId } = await params;
  const { actor, quote, canEdit } = await loadQuote(quoteId);
  const auditEvents = await getQuoteAudit(quote.id);

  const now = requestInstant();

  const canDecide = canDecideApproval({
    actorId: actor.id,
    actorRole: actor.role,
    quoteOwnerId: quote.ownerId,
    teamMemberIds: [],
  });

  const actions = quoteActionsFor({
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    ownerId: quote.ownerId,
    actorId: actor.id,
    actorRole: actor.role,
    canEdit,
    canDecide,
    hasVersion: (quote.currentVersion?.items.length ?? 0) > 0,
    recipientEmail: quote.location?.contactEmail ?? quote.customer.email,
  });

  // Restoring re-enters configuration, so it is offered exactly when that
  // transition is (or configuration is already under way).
  const canRestore =
    canEdit &&
    (quote.status === 'CONFIGURING' ||
      canTransition({
        from: quote.status,
        to: 'CONFIGURING',
        actorRole: actor.role,
        actorId: actor.id,
        quoteOwnerId: quote.ownerId,
      }).allowed);

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {quote.currentVersion && quote.currentVersion.items.length > 0 ? (
              <DocumentGenerator quoteId={quote.id} quoteNumber={quote.quoteNumber} />
            ) : null}
            <QuoteActionBar
              quoteId={quote.id}
              quoteNumber={quote.quoteNumber}
              currentVersionId={quote.currentVersionId}
              actions={actions}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 flex flex-col gap-5 xl:order-1">
          <LineItemsTable items={quote.currentVersion?.items ?? []} />
          <VersionHistoryTable
            quoteId={quote.id}
            versions={quote.versions}
            canRestore={canRestore}
            now={now}
          />
          <ApprovalsList approvals={quote.approvals} now={now} />
          <AuditTimeline events={auditEvents} now={now} />
        </div>

        <div className="order-1 xl:sticky xl:top-4 xl:order-2 xl:self-start">
          <PricingSummary version={quote.currentVersion} />
        </div>
      </div>
    </div>
  );
}
