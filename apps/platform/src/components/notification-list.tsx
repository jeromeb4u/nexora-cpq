'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@nexora/ui';
import type { NotificationType } from '@nexora/types';

import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notification-actions';
import { RelativeTime } from './relative-time';

export interface NotificationRow {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly href: string | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationListProps {
  readonly notifications: readonly NotificationRow[];
  readonly unreadCount: number;
  /** Epoch ms captured once by the page, so every timestamp shares one instant. */
  readonly now: number;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  APPROVAL_REQUESTED: 'Approval requested',
  APPROVAL_GRANTED: 'Approved',
  APPROVAL_REJECTED: 'Rejected',
  QUOTE_ACCEPTED: 'Accepted',
  QUOTE_EXPIRING: 'Expiring',
};

/**
 * The signed-in user's notifications.
 *
 * Following a notification marks it read and then navigates; because the
 * destination may live in the CPQ zone, that navigation is a plain document
 * load rather than a client-side route change (docs/MFE.md).
 */
export function NotificationList({ notifications, unreadCount, now }: NotificationListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function open(notification: NotificationRow) {
    startTransition(async () => {
      if (!notification.readAt) await markNotificationRead({ notificationId: notification.id });
      if (notification.href) {
        window.location.assign(notification.href);
      } else {
        router.refresh();
      }
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.ok) {
        toast.success(
          result.data.read === 1
            ? '1 notification marked read'
            : `${result.data.read} notifications marked read`,
        );
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</CardTitle>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAll} isLoading={isPending}>
            Mark all as read
          </Button>
        ) : null}
      </CardHeader>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Approval requests and decisions on your quotes appear here."
        />
      ) : (
        <CardContent className="p-0">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {notifications.map((notification) => {
              const unread = notification.readAt === null;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    disabled={isPending}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {unread ? (
                        <span
                          className="size-1.5 rounded-full bg-[var(--accent-solid)]"
                          aria-label="Unread"
                        />
                      ) : null}
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {notification.title}
                      </span>
                      <Badge tone="neutral">{TYPE_LABELS[notification.type]}</Badge>
                      <span className="text-2xs text-[var(--text-tertiary)]">
                        <RelativeTime date={notification.createdAt} now={now} />
                      </span>
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]">
                      {notification.body}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
