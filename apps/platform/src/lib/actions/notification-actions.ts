'use server';

import * as notificationService from '../services/notification-service';
import { type ActionResult, run } from './run';

/** Marking your own notifications read. The owner is always the session's user. */

export async function markNotificationRead(
  input: unknown,
): Promise<ActionResult<{ read: number }>> {
  return run('markNotificationRead', (actor) =>
    notificationService.markNotificationRead(actor, input),
  );
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ read: number }>> {
  return run('markAllNotificationsRead', (actor) =>
    notificationService.markAllNotificationsRead(actor),
  );
}
