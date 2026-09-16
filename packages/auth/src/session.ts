import 'server-only';

import { type Role, Role as Roles } from '@nexora/types';

import { auth } from './server';
import {
  type Permission,
  type QuoteAccessContext,
  can,
  canDecideApproval,
  canEditQuote,
  canReadQuote,
} from './permissions';

/**
 * Server-side session access and authorization guards.
 *
 * Every server action and route handler in both MFEs starts by calling one of
 * these. They throw typed errors rather than returning null, so a forgotten
 * check fails loudly instead of quietly proceeding with no user.
 */

/** The authenticated actor, normalised for authorization decisions. */
export interface Actor {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly isActive: boolean;
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'You must be signed in to do that.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN' as const;
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Narrow Better Auth's user shape to our Actor.
 *
 * The additional fields are declared on the auth config, but they arrive typed
 * loosely; this is the one place that reconciles them, so nothing downstream
 * has to guess whether `role` is present.
 */
function toActor(user: {
  id: string;
  email: string;
  name: string;
  role?: unknown;
  isActive?: unknown;
}): Actor {
  const role = typeof user.role === 'string' && isRole(user.role) ? user.role : Roles.SALES_REP;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    isActive: user.isActive !== false,
  };
}

function isRole(value: string): value is Role {
  return value in ROLE_SET;
}

const ROLE_SET: Record<string, true> = {
  [Roles.SALES_REP]: true,
  [Roles.SALES_MANAGER]: true,
  [Roles.PRICING_ADMIN]: true,
  [Roles.ADMIN]: true,
};

/** The current actor, or null when signed out. Never throws. */
export async function getActor(headers: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const actor = toActor(session.user);
  // A deactivated account holds a valid cookie but is not a valid actor.
  if (!actor.isActive) return null;

  return actor;
}

/** The current actor, or throw. Use this in every server action. */
export async function requireActor(headers: Headers): Promise<Actor> {
  const actor = await getActor(headers);
  if (!actor) throw new UnauthorizedError();
  return actor;
}

/** The current actor, or throw unless they hold `permission`. */
export async function requirePermission(
  headers: Headers,
  permission: Permission,
): Promise<Actor> {
  const actor = await requireActor(headers);
  if (!can(actor.role, permission)) {
    throw new ForbiddenError(`Your role does not permit this action (${permission}).`);
  }
  return actor;
}

/** Throw unless the actor may read this quote. */
export function assertCanReadQuote(context: QuoteAccessContext): void {
  if (!canReadQuote(context)) {
    // Deliberately identical to the not-found message at the call site, so an
    // unauthorized probe cannot distinguish "exists but forbidden" from
    // "does not exist" (docs/SECURITY.md).
    throw new ForbiddenError('Quote not found.');
  }
}

/** Throw unless the actor may edit this quote. */
export function assertCanEditQuote(context: QuoteAccessContext): void {
  if (!canEditQuote(context)) {
    throw new ForbiddenError('You do not have permission to modify this quote.');
  }
}

/** Throw unless the actor may approve or reject this quote. */
export function assertCanDecideApproval(context: QuoteAccessContext): void {
  if (!canDecideApproval(context)) {
    throw new ForbiddenError(
      context.actorId === context.quoteOwnerId
        ? 'You cannot approve or reject your own quote.'
        : 'Your role does not permit approving quotes.',
    );
  }
}
