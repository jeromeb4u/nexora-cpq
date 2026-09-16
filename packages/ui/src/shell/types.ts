import type { ComponentType, ReactNode } from 'react';

/**
 * The application shell contract.
 *
 * The shell lives in the shared UI package rather than in either application,
 * because the two micro frontends must feel like one product: identical
 * chrome, identical navigation, identical user menu. Putting it in Platform and
 * importing it from CPQ would couple the two apps' internals, which is exactly
 * what docs/MFE.md forbids.
 *
 * It is deliberately framework-agnostic — no `next/link`, no `next/navigation`.
 * Each app injects its own link component and current pathname, so the package
 * stays free of a framework dependency and can be rendered in isolation.
 */

/** Minimal props any injected link component must accept. */
export interface ShellLinkProps {
  readonly href: string;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly 'aria-current'?: 'page' | undefined;
  readonly onClick?: () => void;
}

export type ShellLinkComponent = ComponentType<ShellLinkProps>;

export interface NavItem {
  readonly label: string;
  readonly href: string;
  /** Lucide icon component, or any component rendering an svg. */
  readonly icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /**
   * True when this destination is served by a DIFFERENT micro frontend.
   *
   * Cross-zone links must be a real navigation, not a client-side route
   * transition: the target app owns its own router and bundle. Rendering them
   * as a plain anchor is what keeps the boundary honest.
   */
  readonly crossZone?: boolean;
  /** Hidden when the signed-in user lacks this capability. */
  readonly requiresPermission?: string;
  /** Optional count badge, e.g. pending approvals. */
  readonly badge?: number;
}

export interface ShellUser {
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly roleLabel: string;
}
