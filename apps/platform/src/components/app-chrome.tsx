'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, buildNavItems, type ShellUser } from '@nexora/ui';
import { authClient } from '@nexora/auth/client';

export interface AppChromeProps {
  readonly user: ShellUser;
  /**
   * Capability strings, not nav items.
   *
   * Nav items carry icon *components*, which cannot cross the server/client
   * boundary — React props must be serialisable. So the server sends plain
   * permission strings and the nav is assembled here, on the client.
   */
  readonly permissions: readonly string[];
  readonly pendingApprovals: number;
  readonly unreadNotifications: number;
  readonly children: React.ReactNode;
}

export function AppChrome({
  user,
  permissions,
  pendingApprovals,
  unreadNotifications,
  children,
}: AppChromeProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = buildNavItems({
    zone: 'platform',
    permissions,
    pendingApprovals,
  });

  const handleSignOut = useCallback(() => {
    void authClient.signOut().then(() => {
      router.push('/sign-in');
      router.refresh();
    });
  }, [router]);

  return (
    <AppShell
      user={user}
      navItems={navItems}
      currentPath={pathname}
      linkComponent={Link}
      onSignOut={handleSignOut}
      notificationCount={unreadNotifications}
      notificationsHref="/activity"
    >
      {children}
    </AppShell>
  );
}
