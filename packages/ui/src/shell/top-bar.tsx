'use client';

import type { ReactNode } from 'react';
import { Bell, ChevronDown, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { cn } from '../lib/cn';
import type { ShellUser } from './types';

export interface TopBarProps {
  readonly user: ShellUser;
  readonly onSignOut: () => void;
  readonly notificationCount: number;
  readonly notificationsHref?: string;
  readonly search?: ReactNode;
  readonly menuButton?: ReactNode;
}

/**
 * Every link in the top bar is a plain anchor, deliberately.
 *
 * This bar renders inside BOTH micro frontends, but Profile, Settings and the
 * notifications feed are all owned by Platform. Inside CPQ, a client-side
 * `next/link` transition would ask CPQ's router for `/profile` — a route it
 * does not have — and 404. A real navigation lets the edge route it to the
 * right application. Same-zone links (the sidebar) still use the injected
 * link component; see `crossZone` in nav-items.ts.
 */
const menuItemClass =
  'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[var(--text-secondary)] outline-none data-[highlighted]:bg-[var(--surface-hover)] data-[highlighted]:text-[var(--text-primary)]';

export function TopBar({
  user,
  onSignOut,
  notificationCount,
  notificationsHref,
  search,
  menuButton,
}: TopBarProps) {
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-(--spacing-topbar) shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 sm:px-6 lg:px-8">
      {menuButton}

      <div className="min-w-0 flex-1">{search}</div>

      {notificationsHref ? (
        <a
          href={notificationsHref}
          className="relative rounded-sm p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <Bell className="size-4" aria-hidden />
          <span className="sr-only">
            {notificationCount > 0
              ? `Notifications, ${notificationCount} unread`
              : 'Notifications'}
          </span>
          {notificationCount > 0 ? (
            <span
              className="tabular absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--color-danger-600)] px-1 text-[10px] font-semibold leading-4 text-white"
              aria-hidden
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          ) : null}
        </a>
      ) : null}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            'flex items-center gap-2 rounded-md px-1.5 py-1 text-left',
            'hover:bg-[var(--surface-hover)] data-[state=open]:bg-[var(--surface-hover)]',
          )}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-2xs font-semibold text-[var(--text-link)]"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-medium text-[var(--text-primary)]">
              {user.name}
            </span>
            <span className="block truncate text-2xs text-[var(--text-tertiary)]">
              {user.roleLabel}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
          <span className="sr-only">Open user menu</span>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-1 shadow-lg"
          >
            <div className="border-b border-[var(--border-subtle)] px-2 py-2">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {user.name}
              </p>
              <p className="truncate text-2xs text-[var(--text-tertiary)]">{user.email}</p>
              <p className="mt-1 text-2xs font-medium text-[var(--text-link)]">{user.roleLabel}</p>
            </div>

            <div className="py-1">
              <DropdownMenu.Item asChild>
                <a href="/profile" className={menuItemClass}>
                  <UserIcon className="size-4" aria-hidden />
                  Profile
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <a href="/settings" className={menuItemClass}>
                  <Settings className="size-4" aria-hidden />
                  Settings
                </a>
              </DropdownMenu.Item>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />

            <DropdownMenu.Item
              className={cn(menuItemClass, 'text-[var(--color-danger-600)]')}
              onSelect={onSignOut}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
