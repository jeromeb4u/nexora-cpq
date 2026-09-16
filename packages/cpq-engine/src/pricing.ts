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
 *   2. per-line discount (term first, then negotiated, each clamped by the
 *      product's own ceiling)
 *   3. totals           (gross − discount)
 *   4. TCV              (MRR × term + OTC)
 *
 * **Discount ceilings are per line, not per bundle.** A router capped at 10%
 * sitting in a quote negotiated at 18% receives 10% while every other line
 * receives 18%. Capping the whole bundle at the least flexible product's
 * ceiling — the obvious-looking simplification — is commercially wrong: it
 * would make almost every mixed hardware/service quote undiscountable, and it
 * silently produces identical totals for different requested discounts.
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

/** How a single line's discount splits between automatic and negotiated. */
interface LineRates {
  readonly termPortion: number;
  readonly manualPortion: number;
  readonly total: number;
  readonly capped: boolean;
}

/**
 * Resolve the rates that actually apply to one product.
 *
 * The term discount is attributed first because it is automatic and
 * unconditional; the negotiated discount then fills whatever headroom the
 * product's ceiling still leaves.
 */
function resolveLineRates(
  product: ProductSnapshot,
  termRate: number,
  manualRate: number,
): LineRates {
  const ceiling = Math.max(0, product.maxDiscountRate);
  const termPortion = Math.min(Math.max(0, termRate), ceiling);
  const manualPortion = Math.min(Math.max(0, manualRate), Math.max(0, ceiling - termPortion));

  return {
    termPortion,
    manualPortion,
    total: termPortion + manualPortion,
    capped: Math.max(0, termRate) + Math.max(0, manualRate) > ceiling,
  };
}

/**
 * Build the priced line items for a configuration.
 *
 * Exported for the configurator's live preview, which shows line-level pricing
 * before a full breakdown is requested.
 */
export function buildPriceLines(
  input: ConfigurationInput,
  catalogue: readonly ProductSnapshot[],
  rates: { readonly termRate: number; readonly manualRate: number } = {
    termRate: 0,
    manualRate: 0,
  },
): readonly PriceLine[] {
  const products = new Map(catalogue.map((product) => [product.id, product]));
  const lines: PriceLine[] = [];

  for (const selection of input.selections) {
    const product = products.get(selection.productId);
    // Unknown products are surfaced as a blocking finding by the configuration
    // engine; pricing simply refuses to invent a price for them.
    if (!product) continue;

    const quantity = billableQuantity(product, selection.quantity, input.siteCount);
    const monthlySubtotal = multiply(product.monthlyPrice, quantity);
    const lineRates = resolveLineRates(product, rates.termRate, rates.manualRate);

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      quantity,
      unitMonthlyPrice: product.monthlyPrice,
      unitSetupPrice: product.setupPrice,
      monthlySubtotal,
      setupSubtotal: multiply(product.setupPrice, quantity),
      appliedDiscountRate: lineRates.total,
      // Sum the two ROUNDED portions rather than rounding the combined rate.
      // Rounding once at the end can differ by a cent from rounding each part,
      // which would leave the customer-facing breakdown not adding up to the
      // total. Reconciliation matters more here than a cent of precision.
      discountAmount: cents(
        applyRate(monthlySubtotal, lineRates.termPortion) +
          applyRate(monthlySubtotal, lineRates.manualPortion),
      ),
      discountCapped: lineRates.capped,
    });
  }

  // Stable, meaningful ordering for the quote document: catalogue order.
  const order = new Map(catalogue.map((product, index) => [product.id, index]));
  return lines
    .slice()
    .sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
}

export interface PriceInput {
  readonly configuration: ConfigurationInput;
  readonly catalogue: readonly ProductSnapshot[];
  /**
   * The negotiated discount rate (0..1) that policy has already approved.
   * Callers MUST pass the rate from the discount engine, never the raw rate a
   * client requested.
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

  const term = termDiscountFor(configuration.contractMonths);
  const termRate = term?.rate ?? 0;
  const manualRate = Math.max(0, approvedManualRate);

  const lines = buildPriceLines(configuration, catalogue, { termRate, manualRate });

  const grossMonthly = add(...lines.map((line) => line.monthlySubtotal));
  const grossSetup = add(...lines.map((line) => line.setupSubtotal));

  // Sum the individually rounded line discounts rather than rounding a total
  // rate, so the line-by-line breakdown the customer sees always adds up.
  const discountMonthly = add(...lines.map((line) => line.discountAmount));

  // Attribute the total across the two discount sources for the breakdown.
  const products = new Map(catalogue.map((product) => [product.id, product]));
  let termAmount = 0;
  let manualAmount = 0;

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) continue;
    const lineRates = resolveLineRates(product, termRate, manualRate);
    termAmount += applyRate(line.monthlySubtotal, lineRates.termPortion);
    manualAmount += applyRate(line.monthlySubtotal, lineRates.manualPortion);
  }

  const discounts: AppliedDiscount[] = [];
  if (term && termAmount > 0) {
    discounts.push({
      code: term.code,
      label: term.label,
      rate: term.rate,
      amount: cents(termAmount),
      automatic: true,
    });
  }
  if (manualRate > 0 && manualAmount > 0) {
    discounts.push({
      code: 'MANUAL',
      label: 'Negotiated discount',
      rate: manualRate,
      amount: cents(manualAmount),
      automatic: false,
    });
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
export function emptyPriceBreakdown(
  contractMonths: PriceBreakdown['contractMonths'],
): PriceBreakdown {
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
    throw new RangeError(
      `Contract term must be a positive whole number of months, received ${contractMonths}`,
    );
  }
  return cents(mrr * contractMonths + otc);
}
