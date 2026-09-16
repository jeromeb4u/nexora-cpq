import 'server-only';

import { prisma } from '@nexora/db';

import type { Actor } from './session';
import { QuoteScope, quoteReadScope } from './permissions';

/**
 * Query scoping.
 *
 * The critical property: visibility is compiled into the WHERE clause rather
 * than checked after a row comes back. Fetching by id and then asking "may I
 * see this?" is how IDOR bugs happen — one forgotten check and the row leaks.
 * If the filter is part of the query, a row the actor may not see simply does
 * not exist as far as the application is concerned.
 *
 * Returns a plain object spread into a Prisma `where`, so this module stays
 * independent of any particular model's generated type.
 */

export type OwnerFilter =
  | Record<string, never>
  | { readonly ownerId: string }
  | { readonly ownerId: { readonly in: string[] } };

/** The ids of everyone reporting to `managerId`, plus the manager themselves. */
async function teamMemberIds(managerId: string): Promise<string[]> {
  const reports = await prisma.user.findMany({
    where: { managerId },
    select: { id: true },
  });
  return [managerId, ...reports.map((report) => report.id)];
}

/**
 * The owner filter for quotes this actor may read.
 *
 * ALL  → no filter
 * TEAM → their own quotes plus their direct reports'
 * OWN  → their own only
 * NONE → an impossible filter, so the query returns nothing
 */
export async function quoteVisibilityFilter(actor: Actor): Promise<OwnerFilter> {
  switch (quoteReadScope(actor.role)) {
    case QuoteScope.ALL:
      return {};
    case QuoteScope.TEAM:
      return { ownerId: { in: await teamMemberIds(actor.id) } };
    case QuoteScope.OWN:
      return { ownerId: actor.id };
    case QuoteScope.NONE:
    default:
      // Deliberately unsatisfiable rather than "return everything".
      return { ownerId: '__no_access__' };
  }
}

/** The team ids used by `canReadQuote`, for per-row checks on a detail page. */
export async function teamIdsFor(actor: Actor): Promise<readonly string[]> {
  if (quoteReadScope(actor.role) !== QuoteScope.TEAM) return [];
  return teamMemberIds(actor.id);
}
