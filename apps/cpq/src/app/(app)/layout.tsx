import { prisma } from '@nexora/db';
import { ROLE_LABELS, Permission, can } from '@nexora/auth/permissions';

import { AppChrome } from '@/components/app-chrome';
import { permissionsOf, requireSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireSession();
  const permissions = permissionsOf(actor);

  const [pendingApprovals, unreadNotifications] = await Promise.all([
    can(actor.role, Permission.APPROVAL_READ_QUEUE)
      ? prisma.quoteApproval.count({ where: { decision: 'PENDING' } })
      : Promise.resolve(0),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
  ]);

  return (
    <AppChrome
      user={{
        name: actor.name,
        email: actor.email,
        role: actor.role,
        roleLabel: ROLE_LABELS[actor.role],
      }}
      permissions={permissions}
      pendingApprovals={pendingApprovals}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppChrome>
  );
}
