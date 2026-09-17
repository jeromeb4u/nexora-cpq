import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@nexora/ui';
import { Permission, ROLE_LABELS, ROLE_PERMISSIONS } from '@nexora/auth/permissions';

import { requireSession } from '@/lib/session';
import { ThemePreferenceControl } from '@/components/theme-preference';

export const metadata: Metadata = { title: 'Settings' };

/** Plain-language descriptions, so the access list reads as capabilities rather than codes. */
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [Permission.CUSTOMER_READ]: 'View customers and their locations',
  [Permission.CUSTOMER_CREATE]: 'Create customers',
  [Permission.CUSTOMER_UPDATE]: 'Edit customer details',
  [Permission.LOCATION_MANAGE]: 'Manage customer locations',
  [Permission.QUOTE_CREATE]: 'Create quotes',
  [Permission.QUOTE_READ_OWN]: 'View your own quotes',
  [Permission.QUOTE_READ_TEAM]: "View your team's quotes",
  [Permission.QUOTE_READ_ALL]: 'View every quote',
  [Permission.QUOTE_UPDATE_OWN]: 'Edit your own quotes',
  [Permission.QUOTE_UPDATE_ANY]: "Edit anyone's quotes",
  [Permission.APPROVAL_DECIDE]: 'Approve or reject escalated quotes',
  [Permission.APPROVAL_READ_QUEUE]: 'See the approvals queue',
  [Permission.PRODUCT_READ]: 'Browse the product catalogue',
  [Permission.PRODUCT_MANAGE]: 'Manage the product catalogue',
  [Permission.RULE_MANAGE]: 'Manage compatibility rules',
  [Permission.PRICING_MANAGE]: 'Manage pricing and discount thresholds',
  [Permission.USER_MANAGE]: 'Manage users and roles',
  [Permission.AUDIT_READ_ALL]: 'Read the full audit trail',
};

export default async function SettingsPage() {
  const actor = await requireSession();
  const permissions = ROLE_PERMISSIONS[actor.role];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" description="Preferences for this browser, and your access." />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Saved in this browser and applied across the whole platform, including quoting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreferenceControl />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your access</CardTitle>
          <CardDescription>
            What the {ROLE_LABELS[actor.role]} role can do. Every one of these is enforced on the
            server — hiding a button is never the only protection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <li
                key={permission}
                className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
              >
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[var(--color-success-600)]"
                  aria-hidden
                />
                <span>{PERMISSION_DESCRIPTIONS[permission] ?? permission}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
