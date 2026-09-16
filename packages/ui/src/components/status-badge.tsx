import * as React from 'react';
import type { CustomerStatus, QuoteStatus, Serviceability } from '@nexora/types';
import { Badge } from './badge';
import type { BadgeProps } from './badge';

type BadgeTone = NonNullable<BadgeProps['tone']>;

interface StatusMeta {
  tone: BadgeTone;
  label: string;
}

/**
 * Every branch below is required by `Record<QuoteStatus, StatusMeta>` — if a
 * member is ever added to `QuoteStatus` and left unmapped here, this file
 * fails to compile.
 */
const QUOTE_STATUS_META: Record<QuoteStatus, StatusMeta> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  CONFIGURING: { tone: 'brand', label: 'Configuring' },
  READY_FOR_REVIEW: { tone: 'info', label: 'Ready for review' },
  APPROVAL_REQUIRED: { tone: 'warning', label: 'Approval required' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
  SENT_TO_CUSTOMER: { tone: 'info', label: 'Sent to customer' },
  ACCEPTED: { tone: 'success', label: 'Accepted' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
};

const CUSTOMER_STATUS_META: Record<CustomerStatus, StatusMeta> = {
  PROSPECT: { tone: 'brand', label: 'Prospect' },
  ACTIVE: { tone: 'success', label: 'Active' },
  SUSPENDED: { tone: 'warning', label: 'Suspended' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
};

const SERVICEABILITY_META: Record<Serviceability, StatusMeta> = {
  AVAILABLE: { tone: 'success', label: 'Available' },
  LIMITED: { tone: 'warning', label: 'Limited' },
  UNAVAILABLE: { tone: 'danger', label: 'Unavailable' },
  PENDING_CHECK: { tone: 'info', label: 'Pending check' },
};

function isQuoteStatus(status: string): status is QuoteStatus {
  return status in QUOTE_STATUS_META;
}

function isCustomerStatus(status: string): status is CustomerStatus {
  return status in CUSTOMER_STATUS_META;
}

function isServiceability(status: string): status is Serviceability {
  return status in SERVICEABILITY_META;
}

export type StatusBadgeValue = QuoteStatus | CustomerStatus | Serviceability;

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  status: StatusBadgeValue;
}

function resolveStatusMeta(status: StatusBadgeValue): StatusMeta {
  if (isQuoteStatus(status)) return QUOTE_STATUS_META[status];
  if (isCustomerStatus(status)) return CUSTOMER_STATUS_META[status];
  if (isServiceability(status)) return SERVICEABILITY_META[status];

  // Unreachable while `StatusBadgeValue` is exactly the union of the three
  // enums above — kept so an enum added to the union without a matching
  // lookup table fails loudly at runtime instead of rendering nothing.
  throw new Error(`StatusBadge: unrecognised status "${status satisfies never}"`);
}

/**
 * Renders a `QuoteStatus`, `CustomerStatus`, or `Serviceability` value as a
 * `Badge` with an appropriate tone and human-readable label.
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, ...props }, ref) => {
    const { tone, label } = resolveStatusMeta(status);
    return (
      <Badge ref={ref} tone={tone} {...props}>
        {label}
      </Badge>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';
