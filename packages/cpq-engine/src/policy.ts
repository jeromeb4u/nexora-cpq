import { type BasisPoints, type Role, Role as Roles } from '@nexora/types';

/**
 * Commercial policy.
 *
 * Every threshold the business can argue about lives in this one file, as data.
 * Nothing else in the codebase hard-codes a discount limit, and no component
 * decides what "too much" means. Changing Nexora's discount policy is a change
 * to this table and its tests — nothing else.
 */

/**
 * The maximum discount each role may grant without escalation, in basis points.
 *
 * ADMIN is capped at the same ceiling as PRICING_ADMIN rather than being
 * unlimited: "full access" in §7 is a statement about system administration,
 * not a licence to give margin away. No role may exceed a product's own
 * `maxDiscountBps` either — that ceiling is absolute.
 */
export const ROLE_MAX_DISCOUNT_BPS: Readonly<Record<Role, BasisPoints>> = {
  [Roles.SALES_REP]: 1_000, // 10%
  [Roles.SALES_MANAGER]: 2_000, // 20%
  [Roles.PRICING_ADMIN]: 3_500, // 35%
  [Roles.ADMIN]: 3_500, // 35%
};

/**
 * Roles ordered by discount authority, ascending. Used to find the lowest role
 * that can approve a given request, so escalation goes to the right desk rather
 * than always to an administrator.
 */
export const DISCOUNT_ESCALATION_ORDER: readonly Role[] = [
  Roles.SALES_REP,
  Roles.SALES_MANAGER,
  Roles.PRICING_ADMIN,
  Roles.ADMIN,
];

/**
 * Contract value above which a quote needs review regardless of discount.
 * A €500k commitment deserves a second pair of eyes even at list price.
 */
export const TCV_APPROVAL_THRESHOLD_CENTS = 50_000_000; // €500,000

/**
 * Term-commitment discount, granted automatically.
 *
 * These are TIERS, not stacking rules: a 60-month contract receives the
 * 60-month rate and nothing else. Expressing them as a lookup keyed by term
 * makes that non-stacking property structural rather than something a reader
 * has to infer from array ordering.
 */
export const TERM_DISCOUNT_BY_MONTHS: Readonly<Record<number, number>> = {
  12: 0,
  24: 0.02,
  36: 0.05,
  48: 0.065,
  60: 0.08,
};

export interface AutomaticDiscount {
  readonly code: string;
  readonly label: string;
  /** 0..1 */
  readonly rate: number;
}

/**
 * The automatic discount a contract term earns, or null when it earns none.
 * The single entry point the pricing engine uses, so "which automatic
 * discounts exist" is answered in exactly one place.
 */
export function termDiscountFor(contractMonths: number): AutomaticDiscount | null {
  const rate = TERM_DISCOUNT_BY_MONTHS[contractMonths] ?? 0;
  if (rate <= 0) return null;

  const years = contractMonths / 12;
  return {
    code: `TERM_${contractMonths}`,
    label: `${years}-year commitment`,
    rate,
  };
}

/** How long a quote stays valid once sent, in days. */
export const QUOTE_VALIDITY_DAYS = 30;
