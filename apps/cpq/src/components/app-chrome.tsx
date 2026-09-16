'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell, buildNavItems, type ShellUser } from '@nexora/ui';
import { authClient } from '@nexora/auth/client';

export interface AppChromeProps {
  readonly user: ShellUser;
  readonly permissions: readonly string[];
  readonly pendingApprovals: number;
  readonly unreadNotifications: number;
  readonly children: React.ReactNode;
}

/**
 * CPQ's chrome.
 *
 * Renders the same AppShell as Platform with `zone: 'cpq'`, which flips which
 * nav items are cross-zone. Everything else is identical, by design.
 */
export function AppChrome({
  user,
  permissions,
  pendingApprovals,
  unreadNotifications,
  children,
}: AppChromeProps) {
  const pathname = usePathname();

  const navItems = buildNavItems({ zone: 'cpq', permissions, pendingApprovals });

  const handleSignOut = useCallback(() => {
    void authClient.signOut().then(() => {
      // Sign-out is Platform's route; a full navigation hands over cleanly.
      window.location.href = '/sign-in';
    });
  }, []);

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
