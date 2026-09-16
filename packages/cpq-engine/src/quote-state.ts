import { type Role, QuoteStatus, Role as Roles } from '@nexora/types';

/**
 * The quote state machine.
 *
 * A quote's status is not a free-text field a client may set. Every transition
 * is declared here with the roles allowed to make it, and the server refuses
 * anything not in this table (§18). That is what stops a sales rep from POSTing
 * `status: APPROVED` and skipping the approval desk entirely.
 *
 * The table is exhaustive over `QuoteStatus`, so adding a state is a compile
 * error until its transitions are declared.
 */

export interface TransitionRule {
  readonly to: QuoteStatus;
  /** Roles permitted to make this transition. */
  readonly roles: readonly Role[];
  /**
   * True when the actor must NOT be the quote's owner.
   * Encodes "you cannot approve your own quote" structurally rather than as a
   * check someone might forget to write.
   */
  readonly forbidsSelf?: boolean;
  readonly description: string;
}

const ALL_ROLES: readonly Role[] = [
  Roles.SALES_REP,
  Roles.SALES_MANAGER,
  Roles.PRICING_ADMIN,
  Roles.ADMIN,
];

const APPROVERS: readonly Role[] = [Roles.SALES_MANAGER, Roles.PRICING_ADMIN, Roles.ADMIN];

export const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly TransitionRule[]>> = {
  [QuoteStatus.DRAFT]: [
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Begin configuring products for the quote.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.CONFIGURING]: [
    {
      to: QuoteStatus.READY_FOR_REVIEW,
      roles: ALL_ROLES,
      description: 'Configuration is valid and priced; ready for internal review.',
    },
    {
      to: QuoteStatus.DRAFT,
      roles: ALL_ROLES,
      description: 'Return to draft.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.READY_FOR_REVIEW]: [
    {
      to: QuoteStatus.APPROVAL_REQUIRED,
      roles: ALL_ROLES,
      description: 'The discount or contract value exceeds the owner’s authority.',
    },
    {
      to: QuoteStatus.APPROVED,
      roles: APPROVERS,
      forbidsSelf: true,
      description: 'Approve a quote that needed no escalation.',
    },
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Reopen for further configuration.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.APPROVAL_REQUIRED]: [
    {
      to: QuoteStatus.APPROVED,
      roles: APPROVERS,
      forbidsSelf: true,
      description: 'Approve the escalated discount.',
    },
    {
      to: QuoteStatus.REJECTED,
      roles: APPROVERS,
      forbidsSelf: true,
      description: 'Reject the escalated discount. A reason is mandatory.',
    },
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Withdraw the request and keep editing.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.APPROVED]: [
    {
      to: QuoteStatus.SENT_TO_CUSTOMER,
      roles: ALL_ROLES,
      description: 'Issue the quote to the customer.',
    },
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Reopen for changes. Approval is void and must be re-obtained.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.REJECTED]: [
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Revise the quote following rejection.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Abandon the quote.',
    },
  ],

  [QuoteStatus.SENT_TO_CUSTOMER]: [
    {
      to: QuoteStatus.ACCEPTED,
      roles: ALL_ROLES,
      description: 'The customer accepted the quote.',
    },
    {
      to: QuoteStatus.EXPIRED,
      roles: ALL_ROLES,
      description: 'The validity period lapsed.',
    },
    {
      to: QuoteStatus.CANCELLED,
      roles: ALL_ROLES,
      description: 'Withdraw the quote.',
    },
  ],

  // Terminal states. A new commercial position requires a new quote or a
  // revision, never a mutation of a concluded one.
  [QuoteStatus.ACCEPTED]: [],
  [QuoteStatus.EXPIRED]: [
    {
      to: QuoteStatus.CONFIGURING,
      roles: ALL_ROLES,
      description: 'Revive an expired quote as a new revision.',
    },
  ],
  [QuoteStatus.CANCELLED]: [],
};

export interface TransitionAttempt {
  readonly from: QuoteStatus;
  readonly to: QuoteStatus;
  readonly actorRole: Role;
  readonly actorId: string;
  readonly quoteOwnerId: string;
}

export type TransitionOutcome =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly code: TransitionErrorCode };

export const TransitionErrorCode = {
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  SELF_APPROVAL: 'SELF_APPROVAL',
} as const;
export type TransitionErrorCode =
  (typeof TransitionErrorCode)[keyof typeof TransitionErrorCode];

/**
 * Decide whether a status change is permitted.
 *
 * Called by the server on every status write. The UI calls it too, but only to
 * decide which buttons to show — the server's answer is the one that counts.
 */
export function canTransition(attempt: TransitionAttempt): TransitionOutcome {
  const rules = QUOTE_TRANSITIONS[attempt.from];
  const rule = rules.find((candidate) => candidate.to === attempt.to);

  if (!rule) {
    return {
      allowed: false,
      code: TransitionErrorCode.INVALID_TRANSITION,
      reason: `A quote cannot move from ${attempt.from} to ${attempt.to}.`,
    };
  }

  if (!rule.roles.includes(attempt.actorRole)) {
    return {
      allowed: false,
      code: TransitionErrorCode.INSUFFICIENT_ROLE,
      reason: `Your role is not permitted to move a quote from ${attempt.from} to ${attempt.to}.`,
    };
  }

  if (rule.forbidsSelf && attempt.actorId === attempt.quoteOwnerId) {
    return {
      allowed: false,
      code: TransitionErrorCode.SELF_APPROVAL,
      reason: 'You cannot approve or reject your own quote.',
    };
  }

  return { allowed: true };
}

/** The transitions an actor may currently perform, for rendering actions. */
export function availableTransitions(
  from: QuoteStatus,
  actorRole: Role,
  actorId: string,
  quoteOwnerId: string,
): readonly TransitionRule[] {
  return QUOTE_TRANSITIONS[from].filter(
    (rule) =>
      canTransition({ from, to: rule.to, actorRole, actorId, quoteOwnerId }).allowed,
  );
}

/** Statuses from which no further progress is possible. */
export function isTerminal(status: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[status].length === 0;
}

/** Statuses that represent a quote still being worked on internally. */
export function isEditable(status: QuoteStatus): boolean {
  return (
    status === QuoteStatus.DRAFT ||
    status === QuoteStatus.CONFIGURING ||
    status === QuoteStatus.REJECTED
  );
}
