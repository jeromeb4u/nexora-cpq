'use client';

import { cn } from '../lib/cn';
import type { NavItem, ShellLinkComponent } from './types';

export interface SidebarNavProps {
  readonly navItems: readonly NavItem[];
  readonly currentPath: string;
  readonly linkComponent: ShellLinkComponent;
  readonly onNavigate?: () => void;
}

/**
 * Decide whether a nav item is the active one.
 *
 * `/quotes` must stay highlighted on `/quotes/abc123`, but `/` must not match
 * everything. Exact match for the root, prefix match on a path boundary
 * otherwise — so `/products` does not light up on `/products-archive`.
 */
function isActive(href: string, currentPath: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function SidebarNav({
  navItems,
  currentPath,
  linkComponent: Link,
  onNavigate,
}: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-(--spacing-topbar) shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
          Nexora
        </span>
        <span className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          Telecom
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Primary">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href, currentPath);
            const Icon = item.icon;

            const className = cn(
              'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              active
                ? 'bg-[var(--surface-selected)] font-medium text-[var(--text-link)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
            );

            const content = (
              <>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span
                    className="tabular inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent-solid)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--text-inverse)]"
                    aria-label={`${item.badge} pending`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </>
            );

            return (
              <li key={item.href}>
                {item.crossZone ? (
                  // A different micro frontend owns this route. A real
                  // navigation hands control to that app's router and bundle;
                  // a client-side transition would try to render a route this
                  // app does not have.
                  <a
                    href={item.href}
                    className={className}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={className}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
          Fictional demonstration system. Not a real telecommunications provider.
        </p>
      </div>
    </div>
  );
}

/** A restrained geometric mark — no gradients, no glow. */
function BrandMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-5 shrink-0" aria-hidden focusable="false">
      <rect width="16" height="16" rx="3" fill="var(--accent-solid)" />
      <path
        d="M4.5 11.5v-7l7 7v-7"
        fill="none"
        stroke="var(--text-inverse)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
