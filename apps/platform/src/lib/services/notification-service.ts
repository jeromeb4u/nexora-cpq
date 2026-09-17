import 'server-only';

import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { markNotificationReadSchema } from '@nexora/validation';

import { type ServiceOutcome, outcome } from './outcome';

/**
 * Marking notifications read.
 *
 * Both writes are scoped by `userId: actor.id` in the WHERE clause, so a
 * notification id belonging to someone else matches nothing rather than
 * leaking its existence — and no audit event is written, because reading your
 * own notification is not an action anyone else needs a record of.
 */

const REVALIDATE = ['/notifications', '/'];

export async function markNotificationRead(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ read: number }>> {
  const data = markNotificationReadSchema.parse(input);

  const result = await prisma.notification.updateMany({
    where: { id: data.notificationId, userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });

  return outcome({ read: result.count }, { revalidate: REVALIDATE });
}

export async function markAllNotificationsRead(
  actor: Actor,
): Promise<ServiceOutcome<{ read: number }>> {
  const result = await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });

  return outcome({ read: result.count }, { revalidate: REVALIDATE });
}
