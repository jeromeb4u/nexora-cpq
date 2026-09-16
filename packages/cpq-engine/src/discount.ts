import {
  type BasisPoints,
  type Cents,
  type DiscountEvaluation,
  type ProductSnapshot,
  type Role,
  ApprovalReason,
  bpsToRate,
  formatRate,
  rateToBps,
} from '@nexora/types';

import {
  DISCOUNT_ESCALATION_ORDER,
  ROLE_MAX_DISCOUNT_BPS,
  TCV_APPROVAL_THRESHOLD_CENTS,
} from './policy';

/**
 * The discount engine.
 *
 * Answers one question: given who is asking, what they are selling, and how
 * much they want to give away — is that allowed, does it need escalation, or is
 * it beyond what anyone may grant?
 *
 * This is the security-critical half of pricing. The browser may *request* a
 * rate; only this function decides what is permitted, and the server calls it
 * on every write. A client that posts 99% gets the same answer as a client that
 * posts it through the UI.
 *
 * **Role authority is what gates approval. Product ceilings are not.**
 * A product's `maxDiscountRate` clamps that product's own line in the pricing
 * engine; it never blocks the quote. Treating the tightest ceiling in a bundle
 * as a global blocker was an earlier design here and it was wrong twice over:
 * it made any quote containing hardware effectively undiscountable, and it made
 * two different requested discounts produce identical totals.
 */

export interface DiscountRequest {
  /** Requested discount in basis points, as submitted. */
  readonly requestedBps: BasisPoints;
  readonly role: Role;
  readonly selectedProducts: readonly ProductSnapshot[];
  /** Total contract value, used for the value-based escalation trigger. */
  readonly tcv: Cents;
}

/** The highest discount any role may grant. Nothing above this is approvable. */
const ABSOLUTE_MAX_BPS = Math.max(...Object.values(ROLE_MAX_DISCOUNT_BPS));

/**
 * The tightest per-product ceiling in the configuration.
 *
 * Informational only: it tells the user some lines will be capped below what
 * they asked for, so the effective blended discount will come in lower than the
 * headline rate. It does not stop the quote.
 */
function tightestCeilingBps(products: readonly ProductSnapshot[]): BasisPoints {
  if (products.length === 0) return 0;
  return products.reduce(
    (lowest, product) => Math.min(lowest, rateToBps(product.maxDiscountRate)),
    Number.POSITIVE_INFINITY,
  );
}

/** The lowest role whose authority covers `requestedBps`, or null if none does. */
function lowestRoleThatCanApprove(requestedBps: BasisPoints): Role | null {
  for (const role of DISCOUNT_ESCALATION_ORDER) {
    if (ROLE_MAX_DISCOUNT_BPS[role] >= requestedBps) return role;
  }
  return null;
}

function roleLabel(role: Role | null): string {
  switch (role) {
    case 'SALES_REP':
      return 'a Sales Representative';
    case 'SALES_MANAGER':
      return 'a Sales Manager';
    case 'PRICING_ADMIN':
      return 'a Pricing Administrator';
    case 'ADMIN':
      return 'an Administrator';
    default:
      return 'a higher authority';
  }
}

function buildExplanation(params: {
  readonly requestedBps: BasisPoints;
  readonly roleMaxBps: BasisPoints;
  readonly tightestBps: BasisPoints;
  readonly escalatesTo: Role | null;
  readonly exceedsAllRoles: boolean;
  readonly withinAuthority: boolean;
  readonly tcvTriggered: boolean;
  readonly someLinesCapped: boolean;
}): string {
  const requested = formatRate(bpsToRate(params.requestedBps));
  const capNote = params.someLinesCapped
    ? ` Some products cap their own discount at ${formatRate(
        bpsToRate(params.tightestBps),
      )}, so the effective discount across the quote will be lower than ${requested}.`
    : '';

  if (params.exceedsAllRoles) {
    return `${requested} exceeds ${formatRate(
      bpsToRate(ABSOLUTE_MAX_BPS),
    )}, the maximum any role may approve. Reduce the discount to continue.${capNote}`;
  }

  if (params.withinAuthority && params.tcvTriggered) {
    return `${requested} is within your authority, but the contract value exceeds the review threshold, so this quote still requires approval.${capNote}`;
  }

  if (params.withinAuthority) {
    return `${requested} is within your approval authority of ${formatRate(
      bpsToRate(params.roleMaxBps),
    )}.${capNote}`;
  }

  return `${requested} exceeds your approval authority of ${formatRate(
    bpsToRate(params.roleMaxBps),
  )}. This quote must be approved by ${roleLabel(params.escalatesTo)}.${capNote}`;
}

/**
 * Evaluate a discount request against policy.
 *
 * Never throws for an out-of-range request — an absurd rate is a normal input
 * that produces a "not allowed" answer, not an exception. That keeps the API
 * usable for live UI feedback as the user drags a slider.
 */
export function evaluateDiscount(request: DiscountRequest): DiscountEvaluation {
  const requestedBps = Math.max(0, Math.round(request.requestedBps));
  const roleMaxBps = ROLE_MAX_DISCOUNT_BPS[request.role];
  const tightestBps = tightestCeilingBps(request.selectedProducts);

  const withinAuthority = requestedBps <= roleMaxBps;
  const exceedsAllRoles = requestedBps > ABSOLUTE_MAX_BPS;
  const tcvTriggered = request.tcv >= TCV_APPROVAL_THRESHOLD_CENTS;

  const escalationTarget = exceedsAllRoles ? null : lowestRoleThatCanApprove(requestedBps);

  const requiresApproval =
    (!withinAuthority && !exceedsAllRoles) || (withinAuthority && tcvTriggered);

  const someLinesCapped =
    request.selectedProducts.length > 0 && requestedBps > tightestBps;

  const reasons: ApprovalReason[] = [];
  if (!withinAuthority && !exceedsAllRoles) {
    reasons.push(ApprovalReason.DISCOUNT_EXCEEDS_THRESHOLD);
  }
  if (tcvTriggered) {
    reasons.push(ApprovalReason.CONTRACT_VALUE_THRESHOLD);
  }

  return {
    requestedRate: bpsToRate(requestedBps),
    roleMaxRate: bpsToRate(roleMaxBps),
    tightestProductRate: bpsToRate(tightestBps),
    allowedRate: bpsToRate(roleMaxBps),
    withinAuthority,
    requiresApproval,
    exceedsAllRoles,
    escalatesTo: requiresApproval && !withinAuthority ? escalationTarget : null,
    someLinesCapped,
    reasons,
    explanation: buildExplanation({
      requestedBps,
      roleMaxBps,
      tightestBps,
      escalatesTo: escalationTarget,
      exceedsAllRoles,
      withinAuthority,
      tcvTriggered,
      someLinesCapped,
    }),
  };
}

/**
 * The negotiated rate the pricing engine should apply.
 *
 * This is the clamp that makes client-submitted pricing harmless. A rate beyond
 * what any role could grant is reduced to that absolute maximum. A rate that
 * merely needs escalation is passed through in full, so the approver reviews the
 * real number they are being asked to sign off — the state machine, not the
 * price, is what stops an unapproved quote from being sent.
 *
 * Per-product ceilings are NOT applied here; the pricing engine applies them
 * per line, which is the only place that has line context.
 */
export function approvedDiscountRate(request: DiscountRequest): number {
  const evaluation = evaluateDiscount(request);

  if (evaluation.exceedsAllRoles) {
    return bpsToRate(ABSOLUTE_MAX_BPS);
  }

  return evaluation.requestedRate;
}

/** Does this evaluation mean the quote cannot move forward at all? */
export function isDiscountBlocked(evaluation: DiscountEvaluation): boolean {
  return evaluation.exceedsAllRoles;
}
