import type {
  PricingModel,
  ProductCategory,
  RuleEffectKind,
  RuleTriggerKind,
  RuleType,
  Serviceability,
  ValidationSeverity,
} from '../../src/generated/prisma/enums';

/**
 * Seed data contract.
 *
 * The catalogue and rule set are plain data, defined separately from the seed
 * script that writes them. Products are referenced by SKU rather than by
 * database id, because ids do not exist until insertion — the seed resolves
 * SKUs to ids in one pass, which also means a typo in a rule fails loudly
 * instead of silently creating a rule that points at nothing.
 */

export interface SeedProduct {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly category: ProductCategory;
  /** Monthly recurring price in euro cents. */
  readonly monthlyPriceCents: number;
  /** One-time setup price in euro cents. */
  readonly setupPriceCents: number;
  readonly pricingModel: PricingModel;
  readonly minContractMonths: number;
  /** Maximum discount in basis points (2000 = 20%). */
  readonly maxDiscountBps: number;
  /** Bandwidth for CONNECTIVITY products; null for every other category. */
  readonly bandwidthMbps: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface SeedRule {
  /** Stable key used for logging and for idempotent re-seeding. */
  readonly key: string;
  readonly type: RuleType;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly priority: number;
  readonly isActive: boolean;

  readonly triggerKind: RuleTriggerKind;
  /** SKU of the triggering product, for PRODUCT_SELECTED. */
  readonly triggerSku: string | null;
  readonly triggerCategory: ProductCategory | null;
  /** Mbps for BANDWIDTH_AT_LEAST, months for CONTRACT_TERM_AT_LEAST. */
  readonly triggerThreshold: number | null;

  readonly effectKind: RuleEffectKind;
  /** SKU of the target product, for the single-product effects. */
  readonly effectSku: string | null;
  /** Months, for MIN_CONTRACT_MONTHS. */
  readonly effectThreshold: number | null;
  readonly effectServiceability: Serviceability | null;
  /** SKUs for the set-valued effects (REQUIRES_ONE_OF, AT_MOST_ONE_OF). */
  readonly targetSkus: readonly string[];
}
