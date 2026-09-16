import {
  type ConfigurationInput,
  type ConfigurationResult,
  type ConfigurationRule,
  type ProductSnapshot,
  type RuleEffect,
  type RuleTrigger,
  type ValidationFinding,
  ProductCategory,
  Serviceability,
  ValidationSeverity,
} from '@nexora/types';

/**
 * The configuration engine.
 *
 * A pure function from (rules, catalogue, selection) to findings. No database,
 * no React, no I/O — which is what makes the business rules testable in
 * isolation and identical on the server and in the browser preview.
 *
 * Rules themselves are data (see `ConfigurationRule`). This module is the only
 * interpreter of that data. Adding a rule to the catalogue must never require
 * touching a component; adding a new *kind* of rule requires exactly one new
 * branch here, and the compiler enforces that via exhaustiveness checks.
 */

/**
 * Serviceability ordered from most to least capable. Used to decide whether a
 * location clears a rule's minimum requirement.
 */
const SERVICEABILITY_RANK: Record<Serviceability, number> = {
  [Serviceability.AVAILABLE]: 3,
  [Serviceability.LIMITED]: 2,
  [Serviceability.PENDING_CHECK]: 1,
  [Serviceability.UNAVAILABLE]: 0,
};

/** Only ERROR stops the user. Everything else informs. */
function isBlocking(severity: ValidationSeverity): boolean {
  return severity === ValidationSeverity.ERROR;
}

/** Exhaustiveness guard: makes an unhandled union member a compile error. */
function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}

/**
 * The working set the evaluator reasons over: selections resolved against the
 * catalogue, plus the derived facts rules ask about.
 */
interface EvaluationContext {
  readonly selectedIds: ReadonlySet<string>;
  readonly products: ReadonlyMap<string, ProductSnapshot>;
  readonly selected: readonly ProductSnapshot[];
  readonly categories: ReadonlySet<ProductCategory>;
  /** Highest bandwidth among selected CONNECTIVITY products, 0 if none. */
  readonly maxBandwidthMbps: number;
  readonly contractMonths: number;
  readonly serviceability: Serviceability;
}

function buildContext(
  input: ConfigurationInput,
  catalogue: readonly ProductSnapshot[],
): EvaluationContext {
  const products = new Map(catalogue.map((product) => [product.id, product]));
  const selectedIds = new Set(input.selections.map((selection) => selection.productId));

  const selected: ProductSnapshot[] = [];
  for (const id of selectedIds) {
    const product = products.get(id);
    if (product) selected.push(product);
  }

  const categories = new Set(selected.map((product) => product.category));

  const maxBandwidthMbps = selected.reduce(
    (highest, product) => Math.max(highest, product.bandwidthMbps ?? 0),
    0,
  );

  return {
    selectedIds,
    products,
    selected,
    categories,
    maxBandwidthMbps,
    contractMonths: input.contractMonths,
    serviceability: input.serviceability,
  };
}

function matchesTrigger(trigger: RuleTrigger, context: EvaluationContext): boolean {
  switch (trigger.kind) {
    case 'PRODUCT_SELECTED':
      return context.selectedIds.has(trigger.productId);
    case 'CATEGORY_SELECTED':
      return context.categories.has(trigger.category);
    case 'BANDWIDTH_AT_LEAST':
      return context.maxBandwidthMbps >= trigger.mbps;
    case 'CONTRACT_TERM_AT_LEAST':
      return context.contractMonths >= trigger.months;
    case 'ALWAYS':
      return true;
    default:
      return assertNever(trigger, 'rule trigger');
  }
}

function nameOf(context: EvaluationContext, productId: string): string {
  return context.products.get(productId)?.name ?? productId;
}

/**
 * Evaluate a fired rule's effect.
 * Returns a finding when the effect is violated, or null when it is satisfied.
 */
function evaluateEffect(
  rule: ConfigurationRule,
  effect: RuleEffect,
  context: EvaluationContext,
): ValidationFinding | null {
  const base = {
    ruleId: rule.id,
    severity: rule.severity,
    message: rule.message,
    blocking: isBlocking(rule.severity),
  };

  switch (effect.kind) {
    case 'REQUIRES_PRODUCT': {
      if (context.selectedIds.has(effect.productId)) return null;
      return {
        ...base,
        relatedProductIds: [effect.productId],
        remedy: { kind: 'ADD_PRODUCT', productId: effect.productId },
      };
    }

    case 'REQUIRES_ONE_OF': {
      const satisfied = effect.productIds.some((id) => context.selectedIds.has(id));
      if (satisfied) return null;
      return {
        ...base,
        relatedProductIds: effect.productIds,
        // Only offer a one-click remedy when the choice is unambiguous.
        ...(effect.productIds.length === 1 && effect.productIds[0]
          ? { remedy: { kind: 'ADD_PRODUCT' as const, productId: effect.productIds[0] } }
          : {}),
      };
    }

    case 'INCOMPATIBLE_WITH_PRODUCT': {
      if (!context.selectedIds.has(effect.productId)) return null;
      return {
        ...base,
        relatedProductIds: [effect.productId],
        remedy: { kind: 'REMOVE_PRODUCT', productId: effect.productId },
      };
    }

    case 'RECOMMENDS_PRODUCT': {
      if (context.selectedIds.has(effect.productId)) return null;
      return {
        ...base,
        relatedProductIds: [effect.productId],
        remedy: { kind: 'ADD_PRODUCT', productId: effect.productId },
      };
    }

    case 'AT_MOST_ONE_OF': {
      const chosen = effect.productIds.filter((id) => context.selectedIds.has(id));
      if (chosen.length <= 1) return null;
      // Report the surplus: keep the first, offer to drop the second.
      const surplus = chosen[1];
      return {
        ...base,
        message: `${rule.message} (${chosen.map((id) => nameOf(context, id)).join(', ')})`,
        relatedProductIds: chosen,
        ...(surplus ? { remedy: { kind: 'REMOVE_PRODUCT' as const, productId: surplus } } : {}),
      };
    }

    case 'MIN_CONTRACT_MONTHS': {
      if (context.contractMonths >= effect.months) return null;
      return {
        ...base,
        relatedProductIds: [],
        remedy: { kind: 'SET_CONTRACT_MONTHS', months: effect.months },
      };
    }

    case 'MIN_SERVICEABILITY': {
      const required = SERVICEABILITY_RANK[effect.level];
      const actual = SERVICEABILITY_RANK[context.serviceability];
      if (actual >= required) return null;
      return { ...base, relatedProductIds: [] };
    }

    default:
      return assertNever(effect, 'rule effect');
  }
}

/**
 * Findings the engine produces without any authored rule, because they are
 * invariants of the catalogue rather than configurable policy.
 */
function intrinsicFindings(context: EvaluationContext): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // A location that cannot be served cannot be quoted, regardless of rules.
  if (context.serviceability === Serviceability.UNAVAILABLE) {
    findings.push({
      ruleId: 'intrinsic:serviceability-unavailable',
      severity: ValidationSeverity.ERROR,
      message:
        'This location is not serviceable. Configuration cannot proceed until a serviceable location is selected.',
      blocking: true,
      relatedProductIds: [],
    });
  }

  if (context.serviceability === Serviceability.PENDING_CHECK) {
    findings.push({
      ruleId: 'intrinsic:serviceability-pending',
      severity: ValidationSeverity.WARNING,
      message:
        'Serviceability at this location has not been confirmed. The quote can be prepared, but delivery dates are provisional until the check completes.',
      blocking: false,
      relatedProductIds: [],
    });
  }

  // Each product carries its own minimum term; the longest one wins.
  for (const product of context.selected) {
    if (context.contractMonths < product.minContractMonths) {
      findings.push({
        ruleId: `intrinsic:min-term:${product.id}`,
        severity: ValidationSeverity.ERROR,
        message: `${product.name} requires a minimum contract of ${product.minContractMonths} months.`,
        blocking: true,
        relatedProductIds: [product.id],
        remedy: { kind: 'SET_CONTRACT_MONTHS', months: product.minContractMonths },
      });
    }
  }

  // An inactive product may still sit on an old draft; surface it rather than
  // silently repricing.
  for (const product of context.selected) {
    if (!product.isActive) {
      findings.push({
        ruleId: `intrinsic:inactive:${product.id}`,
        severity: ValidationSeverity.ERROR,
        message: `${product.name} has been withdrawn from the catalogue and must be removed.`,
        blocking: true,
        relatedProductIds: [product.id],
        remedy: { kind: 'REMOVE_PRODUCT', productId: product.id },
      });
    }
  }

  // A selection referencing a product that no longer exists at all.
  for (const id of context.selectedIds) {
    if (!context.products.has(id)) {
      findings.push({
        ruleId: `intrinsic:unknown-product:${id}`,
        severity: ValidationSeverity.ERROR,
        message: `A selected product is no longer available in the catalogue and must be removed.`,
        blocking: true,
        relatedProductIds: [id],
        remedy: { kind: 'REMOVE_PRODUCT', productId: id },
      });
    }
  }

  // Connectivity is the spine of every Nexora quote; flag its absence early.
  if (context.selected.length > 0 && !context.categories.has(ProductCategory.CONNECTIVITY)) {
    findings.push({
      ruleId: 'intrinsic:no-connectivity',
      severity: ValidationSeverity.WARNING,
      message:
        'This configuration has no connectivity product. Most services depend on an underlying access circuit.',
      blocking: false,
      relatedProductIds: [],
    });
  }

  return findings;
}

/**
 * Evaluate a configuration.
 *
 * Rules run in `priority` order, ties broken by id, so the finding list is
 * deterministic — which matters because it is snapshotted onto the quote
 * version and rendered in a fixed order.
 */
export function evaluateConfiguration(
  input: ConfigurationInput,
  catalogue: readonly ProductSnapshot[],
  rules: readonly ConfigurationRule[],
): ConfigurationResult {
  const context = buildContext(input, catalogue);

  const applicable = rules
    .filter((rule) => rule.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const findings: ValidationFinding[] = [...intrinsicFindings(context)];

  for (const rule of applicable) {
    if (!matchesTrigger(rule.trigger, context)) continue;
    const finding = evaluateEffect(rule, rule.effect, context);
    if (finding) findings.push(finding);
  }

  const isValid = !findings.some((finding) => finding.blocking);

  return {
    findings,
    isValid,
    canProceed: isValid && context.selected.length > 0,
  };
}

/**
 * The set of products a rule says are mandatory given the current selection.
 * Powers the "Required" panel in the configurator without re-running the whole
 * evaluation in the component.
 */
export function requiredProductIds(
  input: ConfigurationInput,
  catalogue: readonly ProductSnapshot[],
  rules: readonly ConfigurationRule[],
): readonly string[] {
  const context = buildContext(input, catalogue);
  const required = new Set<string>();

  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (!matchesTrigger(rule.trigger, context)) continue;

    if (rule.effect.kind === 'REQUIRES_PRODUCT') {
      required.add(rule.effect.productId);
    }
    if (rule.effect.kind === 'REQUIRES_ONE_OF') {
      const alreadySatisfied = rule.effect.productIds.some((id) => context.selectedIds.has(id));
      if (!alreadySatisfied) {
        for (const id of rule.effect.productIds) required.add(id);
      }
    }
  }

  return [...required];
}
