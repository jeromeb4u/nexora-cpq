import 'server-only';

import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { quoteVisibilityFilter } from '@nexora/auth/scope';

/**
 * Data access for the global activity feed.
 *
 * Scoped to this route rather than living in `src/lib`, because this page is
 * the only consumer and the task boundary for this feature keeps new lib
 * modules to `src/lib/customers.ts` only.
 */

/** The signed-in user's own notifications, newest first. */
export async function getMyNotifications(actor: Actor, take = 30) {
  return prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

/**
 * Recent audit events the actor is entitled to see, newest first.
 *
 * Deliberately not a global firehose: scoped to quotes the actor may read
 * (via `quoteVisibilityFilter`, the same scope `getDashboardMetrics` and
 * `getRecentActivity` use) plus events the actor themselves performed. A
 * sales rep sees their own trail, a manager sees their team's, and nobody
 * sees an audit line about a deal they have no access to.
 */
export async function getVisibleAuditEvents(actor: Actor, take = 50) {
  const ownerFilter = await quoteVisibilityFilter(actor);

  const visibleQuotes = await prisma.quote.findMany({
    where: ownerFilter,
    select: { id: true },
  });
  const visibleIds = visibleQuotes.map((quote) => quote.id);

  return prisma.auditEvent.findMany({
    where: {
      OR: [{ entity: 'QUOTE', entityId: { in: visibleIds } }, { actorId: actor.id }],
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}
