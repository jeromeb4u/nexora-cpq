import 'server-only';

import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';

/**
 * A user's own notifications.
 *
 * Scoped by the session's actor id in the query itself — a notification
 * belongs to exactly one person, and there is no id in any input that could
 * point somewhere else.
 */
export async function listNotifications(actor: Actor, take = 50) {
  return prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
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
