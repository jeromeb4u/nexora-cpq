/**
 * Canonical domain enumerations.
 *
 * These are the single source of truth for every enumerated value in the
 * system. The Prisma schema mirrors them, and `packages/db` ships a test that
 * fails if the two ever drift. They are declared as frozen const objects
 * rather than TypeScript `enum` so that:
 *   - values survive `verbatimModuleSyntax` / `isolatedModules` cleanly,
 *   - they are plain data at runtime (usable in Zod, Prisma, and the client),
 *   - the union type is derived, never hand-maintained.
 */

// --------------------------------------------------------------------------
// Access control
// --------------------------------------------------------------------------

export const Role = {
  SALES_REP: 'SALES_REP',
  SALES_MANAGER: 'SALES_MANAGER',
  PRICING_ADMIN: 'PRICING_ADMIN',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role);

// --------------------------------------------------------------------------
// Customer
// --------------------------------------------------------------------------

export const CustomerStatus = {
  PROSPECT: 'PROSPECT',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];
export const CUSTOMER_STATUSES = Object.values(CustomerStatus);

export const Industry = {
  MANUFACTURING: 'MANUFACTURING',
  FINANCIAL_SERVICES: 'FINANCIAL_SERVICES',
  HEALTHCARE: 'HEALTHCARE',
  RETAIL: 'RETAIL',
  LOGISTICS: 'LOGISTICS',
  PUBLIC_SECTOR: 'PUBLIC_SECTOR',
  TECHNOLOGY: 'TECHNOLOGY',
  ENERGY_UTILITIES: 'ENERGY_UTILITIES',
  PROFESSIONAL_SERVICES: 'PROFESSIONAL_SERVICES',
  EDUCATION: 'EDUCATION',
} as const;
export type Industry = (typeof Industry)[keyof typeof Industry];
export const INDUSTRIES = Object.values(Industry);

/**
 * Whether Nexora can physically deliver service at a location.
 * The configuration engine treats UNAVAILABLE as a hard stop and LIMITED as a
 * bandwidth ceiling — see `packages/cpq-engine`.
 */
export const Serviceability = {
  AVAILABLE: 'AVAILABLE',
  LIMITED: 'LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  PENDING_CHECK: 'PENDING_CHECK',
} as const;
export type Serviceability = (typeof Serviceability)[keyof typeof Serviceability];
export const SERVICEABILITIES = Object.values(Serviceability);

// --------------------------------------------------------------------------
// Catalogue
// --------------------------------------------------------------------------

export const ProductCategory = {
  CONNECTIVITY: 'CONNECTIVITY',
  SD_WAN: 'SD_WAN',
  SECURITY: 'SECURITY',
  HARDWARE: 'HARDWARE',
  VOICE: 'VOICE',
  SUPPORT: 'SUPPORT',
} as const;
export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];
export const PRODUCT_CATEGORIES = Object.values(ProductCategory);

/**
 * How a product's price behaves when quantity changes.
 * PER_UNIT   — hardware, SIP channels: price × quantity.
 * FLAT       — a service billed once per quote regardless of quantity.
 * PER_SITE   — billed once per selected location.
 */
export const PricingModel = {
  PER_UNIT: 'PER_UNIT',
  FLAT: 'FLAT',
  PER_SITE: 'PER_SITE',
} as const;
export type PricingModel = (typeof PricingModel)[keyof typeof PricingModel];
export const PRICING_MODELS = Object.values(PricingModel);

// --------------------------------------------------------------------------
// Configuration rules
// --------------------------------------------------------------------------

/**
 * The rule kinds the configuration engine understands. Adding a kind here
 * forces a matching branch in the engine's evaluator (the switch is
 * exhaustiveness-checked), so rules can never be silently unhandled.
 */
export const RuleType = {
  /** Selecting the trigger makes the target mandatory. */
  REQUIRES: 'REQUIRES',
  /** Trigger and target may not both be selected. */
  INCOMPATIBLE: 'INCOMPATIBLE',
  /** Trigger suggests the target; non-blocking. */
  RECOMMENDS: 'RECOMMENDS',
  /** At most one product from the target group may be selected. */
  MUTUALLY_EXCLUSIVE: 'MUTUALLY_EXCLUSIVE',
  /** Trigger imposes a minimum contract term. */
  MIN_CONTRACT_TERM: 'MIN_CONTRACT_TERM',
  /** Trigger requires a minimum location serviceability level. */
  REQUIRES_SERVICEABILITY: 'REQUIRES_SERVICEABILITY',
} as const;
export type RuleType = (typeof RuleType)[keyof typeof RuleType];
export const RULE_TYPES = Object.values(RuleType);

/**
 * Severity of a configuration finding. Only ERROR blocks progression;
 * everything else is advisory. The UI renders each level distinctly (§14).
 */
export const ValidationSeverity = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  REQUIRED: 'REQUIRED',
  RECOMMENDATION: 'RECOMMENDATION',
  INFORMATION: 'INFORMATION',
} as const;
export type ValidationSeverity = (typeof ValidationSeverity)[keyof typeof ValidationSeverity];
export const VALIDATION_SEVERITIES = Object.values(ValidationSeverity);

// --------------------------------------------------------------------------
// Quote lifecycle
// --------------------------------------------------------------------------

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  CONFIGURING: 'CONFIGURING',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT_TO_CUSTOMER: 'SENT_TO_CUSTOMER',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];
export const QUOTE_STATUSES = Object.values(QuoteStatus);

export const ApprovalDecision = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];
export const APPROVAL_DECISIONS = Object.values(ApprovalDecision);

/**
 * Why a quote needed escalation. Stored on the approval so the reviewer sees
 * the reason without recomputing it, and so the audit trail stays meaningful
 * after thresholds change.
 */
export const ApprovalReason = {
  DISCOUNT_EXCEEDS_THRESHOLD: 'DISCOUNT_EXCEEDS_THRESHOLD',
  CONTRACT_VALUE_THRESHOLD: 'CONTRACT_VALUE_THRESHOLD',
  NON_STANDARD_TERM: 'NON_STANDARD_TERM',
  MANUAL_ESCALATION: 'MANUAL_ESCALATION',
} as const;
export type ApprovalReason = (typeof ApprovalReason)[keyof typeof ApprovalReason];
export const APPROVAL_REASONS = Object.values(ApprovalReason);

// --------------------------------------------------------------------------
// Audit
// --------------------------------------------------------------------------

export const AuditAction = {
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  LOCATION_CREATED: 'LOCATION_CREATED',
  LOCATION_UPDATED: 'LOCATION_UPDATED',
  QUOTE_CREATED: 'QUOTE_CREATED',
  QUOTE_UPDATED: 'QUOTE_UPDATED',
  QUOTE_STATUS_CHANGED: 'QUOTE_STATUS_CHANGED',
  QUOTE_VERSION_CREATED: 'QUOTE_VERSION_CREATED',
  QUOTE_VERSION_RESTORED: 'QUOTE_VERSION_RESTORED',
  PRODUCT_ADDED: 'PRODUCT_ADDED',
  PRODUCT_REMOVED: 'PRODUCT_REMOVED',
  DISCOUNT_CHANGED: 'DISCOUNT_CHANGED',
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  QUOTE_SENT: 'QUOTE_SENT',
  QUOTE_DOCUMENT_GENERATED: 'QUOTE_DOCUMENT_GENERATED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  AUTH_SIGNED_IN: 'AUTH_SIGNED_IN',
  AUTH_SIGN_IN_FAILED: 'AUTH_SIGN_IN_FAILED',
  AUTH_SIGNED_OUT: 'AUTH_SIGNED_OUT',
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export const AUDIT_ACTIONS = Object.values(AuditAction);

export const AuditEntity = {
  CUSTOMER: 'CUSTOMER',
  CUSTOMER_LOCATION: 'CUSTOMER_LOCATION',
  QUOTE: 'QUOTE',
  QUOTE_VERSION: 'QUOTE_VERSION',
  QUOTE_ITEM: 'QUOTE_ITEM',
  QUOTE_APPROVAL: 'QUOTE_APPROVAL',
  PRODUCT: 'PRODUCT',
  USER: 'USER',
} as const;
export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];
export const AUDIT_ENTITIES = Object.values(AuditEntity);

// --------------------------------------------------------------------------
// Notifications
// --------------------------------------------------------------------------

export const NotificationType = {
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
  QUOTE_EXPIRING: 'QUOTE_EXPIRING',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export const NOTIFICATION_TYPES = Object.values(NotificationType);

// --------------------------------------------------------------------------
// Contract terms
// --------------------------------------------------------------------------

/** Contract durations Nexora sells, in months. */
export const CONTRACT_TERMS = [12, 24, 36, 48, 60] as const;
export type ContractTerm = (typeof CONTRACT_TERMS)[number];
