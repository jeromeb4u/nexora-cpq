import {
  type ConfigurationRule,
  type ProductSnapshot,
  type RuleEffect,
  type RuleTrigger,
  bpsToRate,
  cents,
} from '@nexora/types';

import type { Product, ProductRule } from './generated/prisma/client';

/**
 * Projections from persisted rows onto the shared domain types.
 *
 * These live in the database package, not in an application, because the seed
 * script and the CPQ app both need them and must agree exactly — a quote priced
 * one way at seed time and another at runtime would be a silent data
 * inconsistency. The database package already depends on `@nexora/types`, so
 * this introduces no new coupling, and the CPQ engine stays free of any
 * knowledge of Prisma.
 */

export function toProductSnapshot(product: Product): ProductSnapshot {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    monthlyPrice: cents(product.monthlyPriceCents),
    setupPrice: cents(product.setupPriceCents),
    pricingModel: product.pricingModel,
    minContractMonths: product.minContractMonths,
    maxDiscountRate: bpsToRate(product.maxDiscountBps),
    bandwidthMbps: product.bandwidthMbps,
    isActive: product.isActive,
  };
}

/** A rule row with its set-valued effect targets loaded. */
export type ProductRuleWithTargets = ProductRule & {
  targets: { productId: string }[];
};

function toTrigger(rule: ProductRuleWithTargets): RuleTrigger {
  switch (rule.triggerKind) {
    case 'PRODUCT_SELECTED':
      return { kind: 'PRODUCT_SELECTED', productId: rule.triggerProductId ?? '' };
    case 'CATEGORY_SELECTED':
      return { kind: 'CATEGORY_SELECTED', category: rule.triggerCategory ?? 'CONNECTIVITY' };
    case 'BANDWIDTH_AT_LEAST':
      return { kind: 'BANDWIDTH_AT_LEAST', mbps: rule.triggerThreshold ?? 0 };
    case 'CONTRACT_TERM_AT_LEAST':
      return { kind: 'CONTRACT_TERM_AT_LEAST', months: rule.triggerThreshold ?? 0 };
    case 'ALWAYS':
      return { kind: 'ALWAYS' };
  }
}

function toEffect(rule: ProductRuleWithTargets): RuleEffect {
  switch (rule.effectKind) {
    case 'REQUIRES_PRODUCT':
      return { kind: 'REQUIRES_PRODUCT', productId: rule.effectProductId ?? '' };
    case 'REQUIRES_ONE_OF':
      return {
        kind: 'REQUIRES_ONE_OF',
        productIds: rule.targets.map((target) => target.productId),
      };
    case 'INCOMPATIBLE_WITH_PRODUCT':
      return { kind: 'INCOMPATIBLE_WITH_PRODUCT', productId: rule.effectProductId ?? '' };
    case 'RECOMMENDS_PRODUCT':
      return { kind: 'RECOMMENDS_PRODUCT', productId: rule.effectProductId ?? '' };
    case 'AT_MOST_ONE_OF':
      return {
        kind: 'AT_MOST_ONE_OF',
        productIds: rule.targets.map((target) => target.productId),
      };
    case 'MIN_CONTRACT_MONTHS':
      return { kind: 'MIN_CONTRACT_MONTHS', months: rule.effectThreshold ?? 12 };
    case 'MIN_SERVICEABILITY':
      return { kind: 'MIN_SERVICEABILITY', level: rule.effectServiceability ?? 'AVAILABLE' };
  }
}

export function toConfigurationRule(rule: ProductRuleWithTargets): ConfigurationRule {
  return {
    id: rule.id,
    type: rule.type,
    message: rule.message,
    severity: rule.severity,
    isActive: rule.isActive,
    priority: rule.priority,
    trigger: toTrigger(rule),
    effect: toEffect(rule),
  };
}
