import type { Cents } from './money';
import { RuleType } from './enums';
import type {
  ApprovalReason,
  ContractTerm,
  PricingModel,
  ProductCategory,
  Role,
  RuleEffectKind,
  Serviceability,
  ValidationSeverity,
} from './enums';

/* ==========================================================================
 * Catalogue
 * ======================================================================== */

/**
 * The projection of a product that the CPQ engines operate on.
 *
 * Deliberately *not* the Prisma model: the engines are pure functions over
 * plain data so they can be unit-tested with no database, and so a quote can
 * be recalculated against a historical price snapshot rather than today's
 * catalogue.
 */
export interface ProductSnapshot {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly monthlyPrice: Cents;
  readonly setupPrice: Cents;
  readonly pricingModel: PricingModel;
  /** Minimum contract length this product may be sold on, in months. */
  readonly minContractMonths: number;
  /** Maximum discount rate (0..1) permitted on this product, before role caps. */
  readonly maxDiscountRate: number;
  /** Bandwidth in Mbps for CONNECTIVITY products; null elsewhere. */
  readonly bandwidthMbps: number | null;
  readonly isActive: boolean;
}

/* ==========================================================================
 * Configuration rules
 * ======================================================================== */

/**
 * A single declarative compatibility rule.
 *
 * Rules are data, not code (ADR-008). They live in the database, are authored
 * by PRICING_ADMIN, and are evaluated by one interpreter. That is what makes
 * "IF bandwidth >= 1 Gbps THEN Managed Router is required" a row rather than
 * an `if` statement buried in a React component.
 */
export interface ConfigurationRule {
  readonly id: string;
  readonly type: RuleType;
  readonly message: string;
  readonly severity: ValidationSeverity;
  readonly isActive: boolean;
  /** Evaluation order; lower runs first. Ties broken by id for determinism. */
  readonly priority: number;

  /** The rule fires when this condition matches the current selection. */
  readonly trigger: RuleTrigger;
  /** What the rule asserts once triggered. */
  readonly effect: RuleEffect;
}

/** What causes a rule to fire. */
export type RuleTrigger =
  | { readonly kind: 'PRODUCT_SELECTED'; readonly productId: string }
  | { readonly kind: 'CATEGORY_SELECTED'; readonly category: ProductCategory }
  | { readonly kind: 'BANDWIDTH_AT_LEAST'; readonly mbps: number }
  | { readonly kind: 'CONTRACT_TERM_AT_LEAST'; readonly months: number }
  | { readonly kind: 'ALWAYS' };

/** What a fired rule asserts. */
export type RuleEffect =
  | { readonly kind: 'REQUIRES_PRODUCT'; readonly productId: string }
  | { readonly kind: 'REQUIRES_ONE_OF'; readonly productIds: readonly string[] }
  | { readonly kind: 'INCOMPATIBLE_WITH_PRODUCT'; readonly productId: string }
  | { readonly kind: 'RECOMMENDS_PRODUCT'; readonly productId: string }
  | { readonly kind: 'AT_MOST_ONE_OF'; readonly productIds: readonly string[] }
  | { readonly kind: 'MIN_CONTRACT_MONTHS'; readonly months: number }
  | { readonly kind: 'MIN_SERVICEABILITY'; readonly level: Serviceability };

/* ==========================================================================
 * Configuration input / output
 * ======================================================================== */

/** One product chosen in a configuration, with its quantity. */
export interface ConfigurationSelection {
  readonly productId: string;
  readonly quantity: number;
}

/** Everything the configuration and pricing engines need to evaluate a quote. */
export interface ConfigurationInput {
  readonly selections: readonly ConfigurationSelection[];
  readonly contractMonths: ContractTerm;
  readonly serviceability: Serviceability;
  /** Number of customer locations the configuration applies to (PER_SITE). */
  readonly siteCount: number;
}

/**
 * A single finding from rule evaluation.
 *
 * `blocking` is derived from severity in exactly one place so the UI never has
 * to decide what counts as fatal.
 */
export interface ValidationFinding {
  readonly ruleId: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly blocking: boolean;
  /** Products this finding is about, for inline highlighting in the UI. */
  readonly relatedProductIds: readonly string[];
  /** A one-click remedy the UI can offer, when one exists. */
  readonly remedy?:
    | { readonly kind: 'ADD_PRODUCT'; readonly productId: string }
    | { readonly kind: 'REMOVE_PRODUCT'; readonly productId: string }
    | { readonly kind: 'SET_CONTRACT_MONTHS'; readonly months: number };
}

export interface ConfigurationResult {
  readonly findings: readonly ValidationFinding[];
  /** True when no ERROR-severity finding is present. */
  readonly isValid: boolean;
  /** True when the configuration is valid *and* has at least one product. */
  readonly canProceed: boolean;
}

/* ==========================================================================
 * Pricing
 * ======================================================================== */

/** Per-product pricing detail, shown as quote line items. */
export interface PriceLine {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly quantity: number;
  readonly unitMonthlyPrice: Cents;
  readonly unitSetupPrice: Cents;
  /** quantity-adjusted, before any discount */
  readonly monthlySubtotal: Cents;
  readonly setupSubtotal: Cents;

  /**
   * The discount rate actually applied to this line, 0..1.
   *
   * Discounts are capped PER LINE by the product's own ceiling, not per bundle.
   * A 10%-capped router sitting in a quote discounted at 18% receives 10% while
   * every other line receives 18% — capping the whole bundle at the least
   * flexible product's ceiling would be commercially wrong and would make most
   * mixed hardware/service quotes undiscountable.
   */
  readonly appliedDiscountRate: number;
  /** Monthly discount on this line, in cents. */
  readonly discountAmount: Cents;
  /** True when the product's own ceiling bound this line below the requested rate. */
  readonly discountCapped: boolean;
}

/** A discount that was actually applied, with the reason it qualified. */
export interface AppliedDiscount {
  readonly code: string;
  readonly label: string;
  /** 0..1 */
  readonly rate: number;
  readonly amount: Cents;
  readonly automatic: boolean;
}

/**
 * The authoritative price of a configuration.
 *
 * Produced only by the server (§33). The browser may render this object but
 * never constructs one that is trusted.
 */
export interface PriceBreakdown {
  readonly lines: readonly PriceLine[];
  /** Sum of line monthly subtotals, before discount. */
  readonly grossMonthly: Cents;
  /** Sum of line setup subtotals, before discount. */
  readonly grossSetup: Cents;
  readonly discounts: readonly AppliedDiscount[];
  /** Total monthly discount amount. */
  readonly discountMonthly: Cents;
  /** Effective blended monthly discount rate, 0..1. */
  readonly effectiveDiscountRate: number;
  /** Monthly Recurring Charge after discount. */
  readonly mrr: Cents;
  /** One-Time Charges after discount. */
  readonly otc: Cents;
  readonly contractMonths: ContractTerm;
  /** Total Contract Value = mrr × contractMonths + otc. */
  readonly tcv: Cents;
}

/* ==========================================================================
 * Discounts / approval
 * ======================================================================== */

/** The outcome of checking a requested discount against policy. */
export interface DiscountEvaluation {
  /** The rate the user asked for, 0..1. */
  readonly requestedRate: number;
  /** The highest rate this role may self-approve, 0..1. */
  readonly roleMaxRate: number;
  /**
   * The tightest per-product ceiling among the selected products, 0..1.
   *
   * Informational, NOT a global blocker: it tells the user that some lines will
   * be capped below the requested rate. Line-level capping happens in the
   * pricing engine — see `PriceLine.appliedDiscountRate`.
   */
  readonly tightestProductRate: number;
  /** The binding ceiling on what this actor may grant unaided: the role cap. */
  readonly allowedRate: number;
  /** True when the request is within `allowedRate`. */
  readonly withinAuthority: boolean;
  /** True when the request needs escalation to a higher role. */
  readonly requiresApproval: boolean;
  /** True when no role can approve it — the request must be reduced. */
  readonly exceedsAllRoles: boolean;
  /** The lowest role that could approve this, when escalation is possible. */
  readonly escalatesTo: Role | null;
  /** True when at least one line will be capped below the requested rate. */
  readonly someLinesCapped: boolean;
  readonly reasons: readonly ApprovalReason[];
  /** Human-readable explanation rendered in the UI (§16). */
  readonly explanation: string;
}

/**
 * The `RuleType` implied by an effect.
 *
 * `type` and `effect` describe the same thing at different resolutions, and a
 * row where they disagree ("REQUIRES" with an "INCOMPATIBLE_WITH_PRODUCT"
 * effect) is nonsense the rule interpreter would never produce. Deriving one
 * from the other means an editor cannot create that row at all.
 */
export function ruleTypeForEffect(effect: RuleEffectKind): RuleType {
  switch (effect) {
    case 'REQUIRES_PRODUCT':
    case 'REQUIRES_ONE_OF':
      return RuleType.REQUIRES;
    case 'INCOMPATIBLE_WITH_PRODUCT':
      return RuleType.INCOMPATIBLE;
    case 'RECOMMENDS_PRODUCT':
      return RuleType.RECOMMENDS;
    case 'AT_MOST_ONE_OF':
      return RuleType.MUTUALLY_EXCLUSIVE;
    case 'MIN_CONTRACT_MONTHS':
      return RuleType.MIN_CONTRACT_TERM;
    case 'MIN_SERVICEABILITY':
      return RuleType.REQUIRES_SERVICEABILITY;
  }
}
