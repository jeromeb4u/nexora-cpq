import { Activity, Boxes, Building2, CheckSquare, FileText, LayoutDashboard } from 'lucide-react';

import type { NavItem } from './types';

/**
 * The single navigation definition for the whole platform.
 *
 * Both micro frontends render the same list, so a user never sees the menu
 * change shape when they cross a zone boundary — which is the entire point of
 * making two deployments feel like one product.
 *
 * `crossZone` is derived from which app is rendering, not hard-coded, so the
 * routing table exists in exactly one place and cannot disagree with itself.
 */

export type Zone = 'platform' | 'cpq';

/** Which zone owns each route. Mirrors apps/platform/microfrontends.json. */
const ZONE_OF_ROUTE = {
  '/dashboard': 'platform',
  '/customers': 'platform',
  '/activity': 'platform',
  '/quotes': 'cpq',
  '/products': 'cpq',
  '/approvals': 'cpq',
} as const satisfies Record<string, Zone>;

type Route = keyof typeof ZONE_OF_ROUTE;

interface NavDefinition {
  readonly label: string;
  readonly href: Route;
  readonly icon: NavItem['icon'];
  readonly requiresPermission?: string;
}

const NAV_DEFINITIONS: readonly NavDefinition[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Customers', href: '/customers', icon: Building2, requiresPermission: 'customer:read' },
  { label: 'Quotes', href: '/quotes', icon: FileText, requiresPermission: 'quote:read:own' },
  { label: 'Products', href: '/products', icon: Boxes, requiresPermission: 'product:read' },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: CheckSquare,
    requiresPermission: 'approval:read:queue',
  },
  { label: 'Activity', href: '/activity', icon: Activity },
];

export interface BuildNavOptions {
  /** The zone doing the rendering. */
  readonly zone: Zone;
  /** Capabilities held by the signed-in user, from @nexora/auth. */
  readonly permissions: readonly string[];
  /** Count shown against the Approvals item. */
  readonly pendingApprovals?: number;
}

/**
 * Build the navigation for a given user and zone.
 *
 * Items the user cannot use are removed rather than disabled: a greyed-out
 * "Approvals" link tells a sales rep about a capability they will never have,
 * which is noise. Note that hiding is presentation only — every route is
 * independently guarded server-side.
 */
export function buildNavItems({
  zone,
  permissions,
  pendingApprovals = 0,
}: BuildNavOptions): readonly NavItem[] {
  const held = new Set(permissions);

  return NAV_DEFINITIONS.filter(
    (definition) => !definition.requiresPermission || held.has(definition.requiresPermission),
  ).map((definition) => ({
    label: definition.label,
    href: definition.href,
    icon: definition.icon,
    crossZone: ZONE_OF_ROUTE[definition.href] !== zone,
    ...(definition.requiresPermission ? { requiresPermission: definition.requiresPermission } : {}),
    ...(definition.href === '/approvals' && pendingApprovals > 0
      ? { badge: pendingApprovals }
      : {}),
  }));
}
