import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@nexora/ui';
import {
  type ApprovalDecision,
  type ApprovalReason,
  bpsToRate,
  cents,
  formatMoney,
  formatRate,
} from '@nexora/types';
import { cn } from '../cn';
import { RelativeTime } from '../relative-time';

const REASON_LABELS: Record<ApprovalReason, string> = {
  DISCOUNT_EXCEEDS_THRESHOLD: 'Discount exceeds threshold',
  CONTRACT_VALUE_THRESHOLD: 'Contract value threshold',
  NON_STANDARD_TERM: 'Non-standard term',
  MANUAL_ESCALATION: 'Manual escalation',
};

const DECISION_META: Record<
  ApprovalDecision,
  { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export interface ApprovalRow {
  readonly id: string;
  readonly decision: ApprovalDecision;
  readonly reason: ApprovalReason;
  readonly requestedDiscountBps: number;
  readonly allowedDiscountBps: number;
  readonly mrrCentsSnapshot: number;
  readonly justification: string;
  readonly decisionNote: string | null;
  readonly requestedBy: { readonly name: string };
  readonly createdAt: Date;
  readonly decidedBy: { readonly name: string } | null;
  readonly decidedAt: Date | null;
}

export interface ApprovalsListProps {
  readonly approvals: readonly ApprovalRow[];
  /** Epoch ms captured once by the page, so all timestamps share one instant. */
  readonly now: number;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{children}</span>
    </div>
  );
}

export function ApprovalsList({ approvals, now }: ApprovalsListProps) {
  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
        </CardHeader>
        <EmptyState
          title="No approvals requested"
          description="This quote has not needed an escalation."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approvals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {approvals.map((approval) => {
          const meta = DECISION_META[approval.decision];
          const isPending = approval.decision === 'PENDING';
          return (
            <div
              key={approval.id}
              className={cn(
                'rounded-md border p-3',
                isPending
                  ? 'border-[var(--color-warning-200)] bg-[var(--color-warning-50)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {REASON_LABELS[approval.reason]}
                  </span>
                </div>
                <span className="text-2xs text-[var(--text-tertiary)]">
                  Requested <RelativeTime date={approval.createdAt} now={now} /> by{' '}
                  {approval.requestedBy.name}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Requested discount">
                  {formatRate(bpsToRate(approval.requestedDiscountBps))}
                </Field>
                <Field label="Allowed discount">
                  {formatRate(bpsToRate(approval.allowedDiscountBps))}
                </Field>
                <Field label="MRR at request">
                  {formatMoney(cents(approval.mrrCentsSnapshot))}
                </Field>
                <Field label="Requested by">{approval.requestedBy.name}</Field>
              </div>

              <div className="mt-3">
                <p className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">
                  Justification
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-primary)]">
                  {approval.justification}
                </p>
              </div>

              {approval.decision !== 'PENDING' ? (
                <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Decided by">{approval.decidedBy?.name ?? '—'}</Field>
                    <Field label="Decided">
                      {approval.decidedAt ? (
                        <RelativeTime date={approval.decidedAt} now={now} />
                      ) : (
                        '—'
                      )}
                    </Field>
                  </div>
                  {approval.decisionNote ? (
                    <div className="mt-3">
                      <p className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">
                        Decision note
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--text-primary)]">
                        {approval.decisionNote}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
