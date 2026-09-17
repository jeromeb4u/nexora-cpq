import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataList,
  DataListItem,
  EmptyState,
  PageHeader,
  StatusBadge,
} from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';
import { canApproveDiscount } from '@nexora/cpq-engine';

import { requirePagePermission } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { listPendingApprovals, listRecentDecisions } from '@/lib/approvals';
import { ApprovalDecision } from '@/components/approval-decision';
import { RelativeTime } from '@/components/relative-time';

export const metadata: Metadata = { title: 'Approvals' };

const REASON_LABELS: Record<string, string> = {
  DISCOUNT_EXCEEDS_THRESHOLD: 'Discount exceeds threshold',
  CONTRACT_VALUE_THRESHOLD: 'Contract value threshold',
  NON_STANDARD_TERM: 'Non-standard term',
  MANUAL_ESCALATION: 'Manual escalation',
};

/**
 * The approval inbox.
 *
 * Each card carries everything needed to decide without opening the quote:
 * what is being sold, at what price, how much discount is being asked for
 * versus what the requester could grant alone, and why they are asking. An
 * approver who has to go hunting for context approves on trust instead of
 * evidence.
 */
export default async function ApprovalsPage() {
  const actor = await requirePagePermission(Permission.APPROVAL_READ_QUEUE);

  const now = requestInstant();

  const [pending, decided] = await Promise.all([
    listPendingApprovals(actor),
    listRecentDecisions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description={
          pending.length === 0
            ? 'Nothing is waiting on you.'
            : `${pending.length} ${pending.length === 1 ? 'quote needs' : 'quotes need'} a decision.`
        }
      />

      {pending.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10">
          <EmptyState
            icon={<Inbox />}
            title="The queue is clear"
            description="Escalated quotes appear here when a discount exceeds the requester's authority or a contract passes the review threshold. Your own quotes never appear — nobody approves their own."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((approval) => {
            const version = approval.quoteVersion;

            return (
              <li key={approval.id}>
                <Card className="border-[var(--color-warning-200)]">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/quotes/${approval.quote.id}`}
                          className="text-[var(--text-link)] hover:underline"
                        >
                          {approval.quote.quoteNumber}
                        </Link>
                        <StatusBadge status={approval.quote.status} />
                        <Badge tone="warning">
                          {REASON_LABELS[approval.reason] ?? approval.reason}
                        </Badge>
                      </CardTitle>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {approval.quote.customer.companyName}
                        {approval.quote.location ? ` · ${approval.quote.location.name}` : null}
                        {' · '}
                        version {version.versionNumber}
                      </p>
                      <p className="mt-0.5 text-2xs text-[var(--text-tertiary)]">
                        Requested by {approval.requestedBy.name} ·{' '}
                        <RelativeTime date={approval.createdAt} now={now} />
                      </p>
                    </div>

                    <ApprovalDecision
                      approvalId={approval.id}
                      quoteNumber={approval.quote.quoteNumber}
                      canApprove={canApproveDiscount(actor.role, approval.requestedDiscountBps)}
                    />
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      <DataList>
                        <DataListItem label="Monthly recurring">
                          <span className="tabular font-semibold text-[var(--text-primary)]">
                            {formatMoney(cents(version.mrrCents))}
                          </span>
                        </DataListItem>
                      </DataList>
                      <DataList>
                        <DataListItem label="Contract value">
                          <span className="tabular">{formatMoney(cents(version.tcvCents))}</span>
                        </DataListItem>
                      </DataList>
                      <DataList>
                        <DataListItem label="Term">{version.contractMonths} months</DataListItem>
                      </DataList>
                      <DataList>
                        <DataListItem label="One-time charges">
                          <span className="tabular">{formatMoney(cents(version.otcCents))}</span>
                        </DataListItem>
                      </DataList>
                    </div>

                    <Alert variant="warning" title="Why this needs approval">
                      <p className="tabular">
                        <strong>{formatRate(bpsToRate(approval.requestedDiscountBps))}</strong>{' '}
                        requested, against a{' '}
                        <strong>{formatRate(bpsToRate(approval.allowedDiscountBps))}</strong> limit
                        for {approval.requestedBy.name.split(' ')[0]}&rsquo;s role.
                        {version.effectiveDiscountBps !== approval.requestedDiscountBps ? (
                          <>
                            {' '}
                            Effective discount across the quote is{' '}
                            {formatRate(bpsToRate(version.effectiveDiscountBps))}, because some
                            products cap their own discount.
                          </>
                        ) : null}
                      </p>
                    </Alert>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                        Justification
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {approval.justification}
                      </p>
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-[var(--text-link)] hover:underline">
                        {version.items.length} line items
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {version.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-baseline justify-between gap-4 text-xs"
                          >
                            <span className="min-w-0 truncate text-[var(--text-secondary)]">
                              <span className="font-mono text-2xs text-[var(--text-tertiary)]">
                                {item.skuSnapshot}
                              </span>{' '}
                              {item.nameSnapshot}
                              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                            </span>
                            <span className="tabular shrink-0 text-[var(--text-secondary)]">
                              {formatMoney(cents(item.monthlyCents))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {decided.map((approval) => (
                <li key={approval.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <Badge tone={approval.decision === 'APPROVED' ? 'success' : 'danger'}>
                    {approval.decision === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </Badge>
                  <Link
                    href={`/quotes/${approval.quote.id}`}
                    className="font-medium text-[var(--text-link)] hover:underline"
                  >
                    {approval.quote.quoteNumber}
                  </Link>
                  <span className="text-[var(--text-secondary)]">
                    {approval.quote.customer.companyName}
                  </span>
                  <span className="tabular text-[var(--text-tertiary)]">
                    {formatRate(bpsToRate(approval.requestedDiscountBps))}
                  </span>
                  <span className="text-2xs text-[var(--text-tertiary)]">
                    {approval.decidedBy?.name ?? 'System'}
                    {approval.decidedAt ? (
                      <>
                        {' · '}
                        <RelativeTime date={approval.decidedAt} now={now} />
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
