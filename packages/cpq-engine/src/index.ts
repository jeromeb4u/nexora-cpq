/**
 * The Nexora CPQ business-rule layer.
 *
 * Pure, dependency-free logic: no database, no React, no I/O. Everything the
 * business can argue about — compatibility, price, discount authority, and the
 * quote lifecycle — lives here and is unit-tested in isolation (ADR-008).
 */

export { evaluateConfiguration, requiredProductIds } from './configuration';

export {
  buildPriceLines,
  calculatePrice,
  emptyPriceBreakdown,
  totalContractValue,
  type PriceInput,
} from './pricing';

export {
  approvedDiscountRate,
  canApproveDiscount,
  evaluateDiscount,
  isDiscountBlocked,
  type DiscountRequest,
} from './discount';

export {
  availableTransitions,
  canTransition,
  isEditable,
  isTerminal,
  QUOTE_TRANSITIONS,
  TransitionErrorCode,
  type TransitionAttempt,
  type TransitionOutcome,
  type TransitionRule,
} from './quote-state';

export {
  DISCOUNT_ESCALATION_ORDER,
  QUOTE_VALIDITY_DAYS,
  ROLE_MAX_DISCOUNT_BPS,
  TCV_APPROVAL_THRESHOLD_CENTS,
  TERM_DISCOUNT_BY_MONTHS,
  termDiscountFor,
  type AutomaticDiscount,
} from './policy';
