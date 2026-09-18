import type {
  ProductCategory,
  RuleEffectKind,
  RuleTriggerKind,
  Serviceability,
} from '@nexora/types';

import { CATEGORY_LABELS, formatBandwidth } from './labels';

/**
 * A rule, in a sentence.
 *
 * The rule editor stores structure — a trigger kind, an effect kind and a few
 * parameters — but a pricing administrator scanning a list of eighteen rules
 * needs to read them, not decode them. This turns a row into "When 10 Gbps or
 * more is selected, require Enterprise Router", which is also exactly what the
 * editor previews back while the rule is being written.
 *
 * Pure and dependency-free so it is unit-tested and usable on both sides.
 */

export interface RuleSummaryInput {
  readonly triggerKind: RuleTriggerKind;
  readonly triggerProductName?: string | null;
  readonly triggerCategory?: ProductCategory | null;
  readonly triggerThreshold?: number | null;
  readonly effectKind: RuleEffectKind;
  readonly effectProductName?: string | null;
  readonly effectThreshold?: number | null;
  readonly effectServiceability?: Serviceability | null;
  readonly targetProductNames?: readonly string[];
}

const SERVICEABILITY_WORDS: Record<Serviceability, string> = {
  AVAILABLE: 'a fully serviceable site',
  LIMITED: 'a site with at least limited serviceability',
  UNAVAILABLE: 'any site',
  PENDING_CHECK: 'a site whose survey is at least pending',
};

const UNSET = 'a product that no longer exists';

export function describeTrigger(rule: RuleSummaryInput): string {
  switch (rule.triggerKind) {
    case 'PRODUCT_SELECTED':
      return `When ${rule.triggerProductName ?? UNSET} is selected`;
    case 'CATEGORY_SELECTED':
      return `When any ${rule.triggerCategory ? CATEGORY_LABELS[rule.triggerCategory] : 'product'} product is selected`;
    case 'BANDWIDTH_AT_LEAST':
      return `When connectivity of ${rule.triggerThreshold ? formatBandwidth(rule.triggerThreshold) : '—'} or more is selected`;
    case 'CONTRACT_TERM_AT_LEAST':
      return `When the term is ${rule.triggerThreshold ?? '—'} months or longer`;
    case 'ALWAYS':
      return 'On every configuration';
  }
}

function list(names: readonly string[] | undefined): string {
  if (!names || names.length === 0) return 'no products';
  if (names.length === 1) return names[0] ?? UNSET;
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export function describeEffect(rule: RuleSummaryInput): string {
  switch (rule.effectKind) {
    case 'REQUIRES_PRODUCT':
      return `require ${rule.effectProductName ?? UNSET}`;
    case 'REQUIRES_ONE_OF':
      return `require one of ${list(rule.targetProductNames)}`;
    case 'INCOMPATIBLE_WITH_PRODUCT':
      return `forbid ${rule.effectProductName ?? UNSET}`;
    case 'RECOMMENDS_PRODUCT':
      return `recommend ${rule.effectProductName ?? UNSET}`;
    case 'AT_MOST_ONE_OF':
      return `allow at most one of ${list(rule.targetProductNames)}`;
    case 'MIN_CONTRACT_MONTHS':
      return `require a term of at least ${rule.effectThreshold ?? '—'} months`;
    case 'MIN_SERVICEABILITY':
      return `require ${rule.effectServiceability ? SERVICEABILITY_WORDS[rule.effectServiceability] : 'a serviceable site'}`;
  }
}

export function describeRule(rule: RuleSummaryInput): string {
  return `${describeTrigger(rule)}, ${describeEffect(rule)}.`;
}
