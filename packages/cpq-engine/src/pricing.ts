import {
  type AppliedDiscount,
  type Cents,
  type ConfigurationInput,
  type PriceBreakdown,
  type PriceLine,
  type ProductSnapshot,
  add,
  applyRate,
  cents,
  multiply,
  PricingModel,
  rateOf,
  subtract,
  ZERO,
} from '@nexora/types';

import { termDiscountFor } from './policy';

/**
 * The pricing engine.
 *
 * One pure function owns every monetary calculation in the product. Components
 * render `PriceBreakdown`; they never compute one. The server recomputes this
 * from scratch on every write, so a browser that posts `discount: 99` changes
 * nothing (§33) — the requested rate is an *input* that policy then clamps.
 *
 * Order of operations is fixed and deliberate:
 *   1. line subtotals   (unit price × quantity, per the product's pricing model)
 *   2. gross totals     (sum of lines)
 *   3. discounts        (automatic, then the manually requested rate)
 *   4. MRR / OTC        (gross − discount)
 *   5. TCV              (MRR × term + OTC)
 *
 * Discounts apply to recurring charges only. Setup fees are cost recovery and
 * are not discountable at Nexora — a deliberate policy choice, documented in
 * docs/CPQ-RULES.md, not an oversight.
 */

/** Quantity actually billed for a line, given the product's pricing model. */
function billableQuantity(
  product: ProductSnapshot,
  requestedQuantity: number,
  siteCount: number,
): number {
  switch (product.pricingModel) {
    case PricingModel.PER_UNIT:
      return Math.max(1, requestedQuantity);
    case PricingModel.PER_SITE:
      return Math.max(1, siteCount);
    case PricingModel.FLAT:
      return 1;
    default: {
      // Defensive: a new pricing model must be handled explicitly.
      const exhaustive: never = product.pricingModel;
      throw new Error(`Unhandled pricing model: ${String(exhaustive)}`);
    }
  }
}

/** Build the priced line items for a configuration. */
export function buildPriceLines(
  input: ConfigurationInput,
  catalogue: readonly ProductSnapshot[],
): readonly PriceLine[] {
  const products = new Map(catalogue.map((product) => [product.id, product]));

  const lines: PriceLine[] = [];

  for (const selection of input.selections) {
    const product = products.get(selection.productId);
    // Unknown products are surfaced as a blocking finding by the configuration
    // engine; pricing simply refuses to invent a price for them.
    if (!product) continue;

    const quantity = billableQuantity(product, selection.quantity, input.siteCount);

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      quantity,
      unitMonthlyPrice: product.monthlyPrice,
      unitSetupPrice: product.setupPrice,
      monthlySubtotal: multiply(product.monthlyPrice, quantity),
      setupSubtotal: multiply(product.setupPrice, quantity),
    });
  }

  // Stable, meaningful ordering for the quote document: catalogue order.
  const order = new Map(catalogue.map((product, index) => [product.id, index]));
  return lines
    .slice()
    .sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
}

/**
 * Automatic discounts the configuration qualifies for without anyone asking —
 * currently term commitment only. These stack additively with the manual
 * discount, but the combined rate is still subject to the policy ceiling, which
 * the discount engine enforces before this function is called.
 */
function automaticDiscounts(input: ConfigurationInput, grossMonthly: Cents): AppliedDiscount[] {
  const term = termDiscountFor(input.contractMonths);
  if (!term) return [];

  return [
    {
      code: term.code,
      label: term.label,
      rate: term.rate,
      amount: applyRate(grossMonthly, term.rate),
      automatic: true,
    },
  ];
}

export interface PriceInput {
  readonly configuration: ConfigurationInput;
  readonly catalogue: readonly ProductSnapshot[];
  /**
   * The manual discount rate (0..1) that policy has already approved.
   * Callers MUST pass the clamped rate from the discount engine, never the
   * raw rate a client requested.
   */
  readonly approvedManualRate: number;
}

/**
 * Compute the authoritative price of a configuration.
 *
 * Deterministic: the same inputs always produce byte-identical output, which is
 * what allows a stored version to be re-verified later.
 */
export function calculatePrice(input: PriceInput): PriceBreakdown {
  const { configuration, catalogue, approvedManualRate } = input;

  const lines = buildPriceLines(configuration, catalogue);

  const grossMonthly = add(...lines.map((line) => line.monthlySubtotal));
  const grossSetup = add(...lines.map((line) => line.setupSubtotal));

  const discounts: AppliedDiscount[] = automaticDiscounts(configuration, grossMonthly);

  if (approvedManualRate > 0) {
    discounts.push({
      code: 'MANUAL',
      label: 'Negotiated discount',
      rate: approvedManualRate,
      amount: applyRate(grossMonthly, approvedManualRate),
      automatic: false,
    });
  }

  // Sum the individual rounded amounts rather than rounding the summed rate, so
  // the line-by-line breakdown the customer sees always adds up to the total.
  let discountMonthly = add(...discounts.map((discount) => discount.amount));

  // A configuration can never be discounted below zero.
  if (discountMonthly > grossMonthly) {
    discountMonthly = grossMonthly;
  }

  const mrr = subtract(grossMonthly, discountMonthly);
  const otc = grossSetup; // setup charges are not discountable — see header
  const tcv = add(multiply(mrr, configuration.contractMonths), otc);

  return {
    lines,
    grossMonthly,
    grossSetup,
    discounts,
    discountMonthly,
    effectiveDiscountRate: rateOf(discountMonthly, grossMonthly),
    mrr,
    otc,
    contractMonths: configuration.contractMonths,
    tcv,
  };
}

/** An empty breakdown, for a quote with nothing configured yet. */
export function emptyPriceBreakdown(contractMonths: PriceBreakdown['contractMonths']): PriceBreakdown {
  return {
    lines: [],
    grossMonthly: ZERO,
    grossSetup: ZERO,
    discounts: [],
    discountMonthly: ZERO,
    effectiveDiscountRate: 0,
    mrr: ZERO,
    otc: ZERO,
    contractMonths,
    tcv: ZERO,
  };
}

/**
 * Total Contract Value.
 *
 * Exposed separately because the dashboard aggregates it over quotes that are
 * already priced, without re-running the full engine.
 */
export function totalContractValue(mrr: Cents, contractMonths: number, otc: Cents): Cents {
  if (!Number.isInteger(contractMonths) || contractMonths <= 0) {
    throw new RangeError(`Contract term must be a positive whole number of months, received ${contractMonths}`);
  }
  return cents(mrr * contractMonths + otc);
}
