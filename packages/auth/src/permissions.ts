import { type Role, Role as Roles } from '@nexora/types';

/**
 * Role-based access control.
 *
 * A capability matrix, expressed as data. Every authorization question in the
 * application resolves to `can(role, permission)` against this table — there is
 * no second place where a role is compared to a string.
 *
 * This module is deliberately pure and free of any framework import, so the
 * server enforces it, the UI consults it to decide what to render, and the test
 * suite exercises it directly. The UI's use is a convenience only: hiding a
 * button is not access control, and every server action checks again (§8).
 */

export const Permission = {
  // --- Customers ---------------------------------------------------------
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',

  // --- Locations ---------------------------------------------------------
  LOCATION_MANAGE: 'location:manage',

  // --- Quotes ------------------------------------------------------------
  QUOTE_CREATE: 'quote:create',
  /** Read and edit quotes you own. */
  QUOTE_READ_OWN: 'quote:read:own',
  /** Read quotes owned by your direct reports. */
  QUOTE_READ_TEAM: 'quote:read:team',
  /** Read every quote in the system. */
  QUOTE_READ_ALL: 'quote:read:all',
  QUOTE_UPDATE_OWN: 'quote:update:own',
  /** Edit a quote you do not own. */
  QUOTE_UPDATE_ANY: 'quote:update:any',

  // --- Approvals ---------------------------------------------------------
  APPROVAL_DECIDE: 'approval:decide',
  APPROVAL_READ_QUEUE: 'approval:read:queue',

  // --- Catalogue ---------------------------------------------------------
  PRODUCT_READ: 'product:read',
  PRODUCT_MANAGE: 'product:manage',
  RULE_MANAGE: 'rule:manage',
  PRICING_MANAGE: 'pricing:manage',

  // --- Administration ----------------------------------------------------
  USER_MANAGE: 'user:manage',
  AUDIT_READ_ALL: 'audit:read:all',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * What each role may do.
 *
 * Note what SALES_MANAGER does NOT have: PRODUCT_MANAGE, RULE_MANAGE and
 * PRICING_MANAGE. A manager can approve a discount but cannot change the
 * thresholds that decide whether approval was needed — separating the
 * transaction from the policy that governs it.
 */
const SALES_REP_PERMISSIONS: readonly Permission[] = [
  Permission.CUSTOMER_READ,
  Permission.CUSTOMER_CREATE,
  Permission.CUSTOMER_UPDATE,
  Permission.LOCATION_MANAGE,
  Permission.QUOTE_CREATE,
  Permission.QUOTE_READ_OWN,
  Permission.QUOTE_UPDATE_OWN,
  Permission.PRODUCT_READ,
];

const SALES_MANAGER_PERMISSIONS: readonly Permission[] = [
  ...SALES_REP_PERMISSIONS,
  Permission.QUOTE_READ_TEAM,
  Permission.APPROVAL_DECIDE,
  Permission.APPROVAL_READ_QUEUE,
];

const PRICING_ADMIN_PERMISSIONS: readonly Permission[] = [
  Permission.CUSTOMER_READ,
  Permission.PRODUCT_READ,
  Permission.PRODUCT_MANAGE,
  Permission.RULE_MANAGE,
  Permission.PRICING_MANAGE,
  Permission.QUOTE_READ_ALL,
  Permission.APPROVAL_DECIDE,
  Permission.APPROVAL_READ_QUEUE,
];

const ADMIN_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Roles.SALES_REP]: SALES_REP_PERMISSIONS,
  [Roles.SALES_MANAGER]: SALES_MANAGER_PERMISSIONS,
  [Roles.PRICING_ADMIN]: PRICING_ADMIN_PERMISSIONS,
  [Roles.ADMIN]: ADMIN_PERMISSIONS,
};

/** Does this role hold this capability? */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Does this role hold every one of these capabilities? */
export function canAll(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** Does this role hold at least one of these capabilities? */
export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

/* ---------------------------------------------------------------------------
 * Quote visibility
 *
 * Read access to a quote is a scope, not a boolean. Resolving it to an explicit
 * scope value means the database query can be built from it directly — which is
 * how IDOR is prevented: the WHERE clause is derived from the actor, rather than
 * a row being fetched by id and then checked afterwards.
 * ------------------------------------------------------------------------- */

export const QuoteScope = {
  OWN: 'OWN',
  TEAM: 'TEAM',
  ALL: 'ALL',
  NONE: 'NONE',
} as const;
export type QuoteScope = (typeof QuoteScope)[keyof typeof QuoteScope];

export function quoteReadScope(role: Role): QuoteScope {
  if (can(role, Permission.QUOTE_READ_ALL)) return QuoteScope.ALL;
  if (can(role, Permission.QUOTE_READ_TEAM)) return QuoteScope.TEAM;
  if (can(role, Permission.QUOTE_READ_OWN)) return QuoteScope.OWN;
  return QuoteScope.NONE;
}

export interface QuoteAccessContext {
  readonly actorId: string;
  readonly actorRole: Role;
  readonly quoteOwnerId: string;
  /** Ids of users reporting to the actor. Empty for non-managers. */
  readonly teamMemberIds: readonly string[];
}

/** May this actor read this quote? */
export function canReadQuote(context: QuoteAccessContext): boolean {
  switch (quoteReadScope(context.actorRole)) {
    case QuoteScope.ALL:
      return true;
    case QuoteScope.TEAM:
      return (
        context.quoteOwnerId === context.actorId ||
        context.teamMemberIds.includes(context.quoteOwnerId)
      );
    case QuoteScope.OWN:
      return context.quoteOwnerId === context.actorId;
    case QuoteScope.NONE:
      return false;
    default:
      return false;
  }
}

/**
 * May this actor modify this quote's configuration?
 *
 * Deliberately stricter than reading: a manager can see a rep's quote without
 * being able to rewrite its pricing behind their back.
 */
export function canEditQuote(context: QuoteAccessContext): boolean {
  if (can(context.actorRole, Permission.QUOTE_UPDATE_ANY)) return true;
  return (
    can(context.actorRole, Permission.QUOTE_UPDATE_OWN) && context.quoteOwnerId === context.actorId
  );
}

/**
 * May this actor decide the approval on this quote?
 *
 * Holding APPROVAL_DECIDE is not sufficient — nobody approves their own quote,
 * regardless of role. The same rule is enforced independently by the quote
 * state machine; two layers agreeing is deliberate.
 */
export function canDecideApproval(context: QuoteAccessContext): boolean {
  if (!can(context.actorRole, Permission.APPROVAL_DECIDE)) return false;
  return context.quoteOwnerId !== context.actorId;
}

/** Human-readable role label for UI and audit summaries. */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [Roles.SALES_REP]: 'Sales Representative',
  [Roles.SALES_MANAGER]: 'Sales Manager',
  [Roles.PRICING_ADMIN]: 'Pricing Administrator',
  [Roles.ADMIN]: 'Administrator',
};
