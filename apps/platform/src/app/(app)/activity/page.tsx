import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, EmptyState, PageHeader } from '@nexora/ui';

import { requireSession } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { RelativeTime } from '@/components/relative-time';
import { ActivityTimeline } from '@/components/customers/activity-timeline';
import { cn } from '@/components/cn';
import { getMyNotifications, getVisibleAuditEvents } from './queries';

export const metadata: Metadata = { title: 'Activity' };

/**
 * The global activity feed: the signed-in user's own notifications, and the
 * recent audit trail they are entitled to see.
 *
 * Deliberately not a firehose — `getVisibleAuditEvents` scopes the audit half
 * to quotes the actor may read plus events they performed themselves, the
 * same scoping the dashboard's "Recent activity" card uses.
 */
export default async function ActivityPage() {
  const actor = await requireSession();
  const now = requestInstant();

  const [notifications, auditEvents] = await Promise.all([
    getMyNotifications(actor),
    getVisibleAuditEvents(actor),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Activity" description="Your notifications, and the recent trail you can see." />

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Approval requests and decisions addressed to you will appear here."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {notifications.map((notification) => {
              const unread = notification.readAt === null;
              const body = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      unread ? 'bg-[var(--accent-solid)]' : 'bg-transparent',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm leading-snug',
                        unread
                          ? 'font-semibold text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{notification.body}</p>
                    <p className="mt-1 text-2xs text-[var(--text-tertiary)]">
                      <RelativeTime date={notification.createdAt} now={now} />
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={notification.id} className={cn(unread && 'bg-[var(--surface-selected)]')}>
                  {/* Every notification deep-links into a route the CPQ MFE owns
                      (e.g. /quotes/:id) — a plain <a>, never next/link. */}
                  {notification.href ? (
                    <a href={notification.href} className="block hover:bg-[var(--surface-hover)]">
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ActivityTimeline events={auditEvents} now={now} />
    </div>
  );
}
