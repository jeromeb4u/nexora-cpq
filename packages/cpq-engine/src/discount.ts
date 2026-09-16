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
 * it impossible?
 *
 * This is the security-critical half of pricing. The browser may *request* a
 * rate; only this function decides what rate is actually applied, and the
 * server calls it on every write. A client that posts 99% gets the same answer
 * as a client that posts it through the UI: clamped, and flagged for approval.
 */

export interface DiscountRequest {
  /** Requested discount in basis points, as submitted. */
  readonly requestedBps: BasisPoints;
  readonly role: Role;
  readonly selectedProducts: readonly ProductSnapshot[];
  /** Total contract value, used for the value-based escalation trigger. */
  readonly tcv: Cents;
}

/**
 * The tightest product ceiling in the configuration.
 *
 * A bundle can never be discounted more than its least flexible component:
 * discounting a bundle 30% when one product caps at 15% would quietly breach
 * that product's margin floor.
 */
function productCeilingBps(products: readonly ProductSnapshot[]): BasisPoints {
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

function buildExplanation(params: {
  readonly requestedBps: BasisPoints;
  readonly roleMaxBps: BasisPoints;
  readonly productMaxBps: BasisPoints;
  readonly role: Role;
  readonly escalatesTo: Role | null;
  readonly exceedsAllRoles: boolean;
  readonly withinAuthority: boolean;
  readonly tcvTriggered: boolean;
}): string {
  const requested = formatRate(bpsToRate(params.requestedBps));

  if (params.requestedBps > params.productMaxBps) {
    return `${requested} exceeds the ${formatRate(
      bpsToRate(params.productMaxBps),
    )} maximum permitted on one or more selected products. No role can approve this — reduce the discount or change the configuration.`;
  }

  if (params.withinAuthority && params.tcvTriggered) {
    return `${requested} is within your authority, but the contract value exceeds the review threshold, so this quote still requires approval.`;
  }

  if (params.withinAuthority) {
    return `${requested} is within your approval authority of ${formatRate(
      bpsToRate(params.roleMaxBps),
    )}.`;
  }

  if (params.exceedsAllRoles) {
    return `${requested} exceeds the maximum discount any role may approve.`;
  }

  return `${requested} exceeds your approval authority of ${formatRate(
    bpsToRate(params.roleMaxBps),
  )}. This quote must be approved by ${roleLabel(params.escalatesTo)}.`;
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
  const productMaxBps = productCeilingBps(request.selectedProducts);

  // The binding ceiling: the user's authority, further limited by the products.
  const allowedBps = Math.min(roleMaxBps, productMaxBps);

  const exceedsProductCeiling = requestedBps > productMaxBps;
  const withinAuthority = requestedBps <= allowedBps;

  const tcvTriggered = request.tcv >= TCV_APPROVAL_THRESHOLD_CENTS;

  // Escalation is only meaningful when the product ceiling still permits it.
  const escalationTarget = exceedsProductCeiling ? null : lowestRoleThatCanApprove(requestedBps);

  const exceedsAllRoles = exceedsProductCeiling || escalationTarget === null;

  const requiresApproval = (!withinAuthority && !exceedsAllRoles) || (withinAuthority && tcvTriggered);

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
    productMaxRate: bpsToRate(productMaxBps),
    allowedRate: bpsToRate(allowedBps),
    withinAuthority,
    requiresApproval,
    exceedsAllRoles,
    escalatesTo: requiresApproval && !withinAuthority ? escalationTarget : null,
    reasons,
    explanation: buildExplanation({
      requestedBps,
      roleMaxBps,
      productMaxBps,
      role: request.role,
      escalatesTo: escalationTarget,
      exceedsAllRoles,
      withinAuthority,
      tcvTriggered,
    }),
  };
}

/**
 * The rate the pricing engine should actually apply.
 *
 * This is the clamp that makes client-submitted pricing harmless. A discount
 * beyond what any role can grant is reduced to the product ceiling; a discount
 * that merely needs escalation is applied in full so the approver sees the real
 * number they are being asked to sign off.
 */
export function approvedDiscountRate(
  request: DiscountRequest,
  options: { readonly hasApproval: boolean } = { hasApproval: false },
): number {
  const evaluation = evaluateDiscount(request);

  if (evaluation.exceedsAllRoles) {
    return evaluation.productMaxRate;
  }

  if (evaluation.withinAuthority || options.hasApproval) {
    return evaluation.requestedRate;
  }

  // Pending escalation: show the requested rate so the approver reviews the
  // actual proposal. The quote cannot be sent until it is approved, and the
  // state machine — not the price — is what enforces that.
  return evaluation.requestedRate;
}

/** Does this evaluation mean the quote cannot move forward at all? */
export function isDiscountBlocked(evaluation: DiscountEvaluation): boolean {
  return evaluation.exceedsAllRoles;
}
