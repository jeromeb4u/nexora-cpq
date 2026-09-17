import type { Metadata } from 'next';
import { PageHeader } from '@nexora/ui';

import { requireSession } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { listNotifications } from '@/lib/notifications';
import { NotificationList } from '@/components/notification-list';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * Notifications for the signed-in user.
 *
 * No permission gate beyond a session: a notification belongs to one person,
 * and the query is scoped to them. Unread first, newest first within that.
 */
export default async function NotificationsPage() {
  const actor = await requireSession();
  const notifications = await listNotifications(actor);
  const unreadCount = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Approval requests, decisions and accepted quotes involving you."
      />
      <NotificationList
        notifications={notifications}
        unreadCount={unreadCount}
        now={requestInstant()}
      />
    </div>
  );
}
