'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { cn } from '../lib/cn';
import type { NavItem, ShellLinkComponent, ShellUser } from './types';
import { SidebarNav } from './sidebar-nav';
import { TopBar } from './top-bar';

export interface AppShellProps {
  readonly user: ShellUser;
  readonly navItems: readonly NavItem[];
  /** Pathname of the current page, for active-state highlighting. */
  readonly currentPath: string;
  readonly linkComponent: ShellLinkComponent;
  readonly onSignOut: () => void;
  readonly notificationCount?: number;
  readonly notificationsHref?: string;
  readonly children: React.ReactNode;
  /** Rendered in the top bar; typically a global search trigger. */
  readonly search?: React.ReactNode;
}

/**
 * The application chrome: persistent sidebar, top bar, content region.
 *
 * Responsive behaviour is a real layout change rather than a shrunken desktop
 * (§29): below `lg` the sidebar becomes an overlay drawer opened from the top
 * bar, and the content region takes the full width.
 */
export function AppShell({
  user,
  navItems,
  currentPath,
  linkComponent,
  onSignOut,
  notificationCount = 0,
  notificationsHref,
  children,
  search,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)]">
      {/* Keyboard users land here first; the shell has a lot of nav to skip. */}
      <a
        href="#main-content"
        className="sr-only rounded-sm bg-[var(--accent-solid)] px-3 py-2 text-[var(--text-inverse)] focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-(--spacing-sidebar) flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] lg:flex"
        aria-label="Main navigation"
      >
        <SidebarNav
          navItems={navItems}
          currentPath={currentPath}
          linkComponent={linkComponent}
        />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(13_17_23/0.6)]"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-(--spacing-sidebar) flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]"
            aria-label="Main navigation"
          >
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-sm p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <SidebarNav
              navItems={navItems}
              currentPath={currentPath}
              linkComponent={linkComponent}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className={cn('flex min-h-screen flex-col', 'lg:pl-(--spacing-sidebar)')}>
        <TopBar
          user={user}
          onSignOut={onSignOut}
          notificationCount={notificationCount}
          notificationsHref={notificationsHref}
          search={search}
          menuButton={
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-sm p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" aria-hidden />
            </button>
          }
        />

        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-(--spacing-content-max)">{children}</div>
        </main>
      </div>
    </div>
  );
}
