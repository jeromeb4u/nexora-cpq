import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataList,
  DataListItem,
  PageHeader,
  StatusBadge,
} from '@nexora/ui';
import { Permission, can } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { getCustomerActivity, getCustomerDetail } from '@/lib/customers';
import { ActivityTimeline } from '@/components/customers/activity-timeline';
import { LocationsSection } from '@/components/customers/locations-section';
import { QuotesSection } from '@/components/customers/quotes-section';
import { INDUSTRY_LABELS } from '@/components/customers/labels';

interface CustomerPageParams {
  readonly customerId: string;
}

/**
 * Shared, per-request-deduplicated fetch of the customer.
 *
 * `generateMetadata` and the page component each need this customer, and
 * `React.cache` collapses them into one `getCustomerDetail` call per request
 * instead of two — see `apps/cpq/src/app/(app)/quotes/[quoteId]/page.tsx`.
 * Not-found is translated to Next's `notFound()` here so both call sites get
 * the same 404 behaviour for free.
 */
const loadCustomer = cache(async (customerId: string) => {
  await requirePagePermission(Permission.CUSTOMER_READ);

  try {
    return await getCustomerDetail(customerId);
  } catch (error) {
    if (isAppError(error, ErrorCode.NOT_FOUND)) {
      notFound();
    }
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<CustomerPageParams>;
}): Promise<Metadata> {
  const { customerId } = await params;
  const customer = await loadCustomer(customerId);
  return { title: customer.companyName };
}

/**
 * Read-only customer detail: overview, locations, quotes, and the activity
 * trail. Nothing on this page mutates data.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<CustomerPageParams>;
}) {
  const { customerId } = await params;
  // Re-resolves the same session `loadCustomer` already gated on — cheap, and
  // it is what the page needs to decide which entry points to render. Hiding
  // a button is not access control (§8): the server actions re-check every
  // one of these permissions independently.
  const actor = await requirePagePermission(Permission.CUSTOMER_READ);
  const customer = await loadCustomer(customerId);
  const activity = await getCustomerActivity(customer.id);

  const now = requestInstant();
  const canEditCustomer = can(actor.role, Permission.CUSTOMER_UPDATE);
  const canManageLocations = can(actor.role, Permission.LOCATION_MANAGE);

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[{ label: 'Customers', href: '/customers' }, { label: customer.companyName }]}
      />

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {customer.companyName}
            <StatusBadge status={customer.status} />
          </span>
        }
        description={customer.legalName}
        actions={
          canEditCustomer ? (
            <Button asChild variant="secondary">
              <Link href={`/customers/${customer.id}/edit`}>Edit customer</Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <DataList>
            <DataListItem label="Legal name">{customer.legalName}</DataListItem>
            <DataListItem label="Industry">{INDUSTRY_LABELS[customer.industry]}</DataListItem>
            <DataListItem label="VAT number">{customer.vatNumber}</DataListItem>
            <DataListItem label="Email">
              <a
                href={`mailto:${customer.email}`}
                className="text-[var(--text-link)] hover:underline"
              >
                {customer.email}
              </a>
            </DataListItem>
            <DataListItem label="Phone">{customer.phone}</DataListItem>
            <DataListItem label="Website">
              {customer.website ? (
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--text-link)] hover:underline"
                >
                  {customer.website}
                </a>
              ) : (
                '—'
              )}
            </DataListItem>
            <DataListItem label="Account owner">{customer.accountOwner.name}</DataListItem>
            <DataListItem label="Created">
              {customer.createdAt.toLocaleDateString('en-GB')}
            </DataListItem>
          </DataList>
        </CardContent>
      </Card>

      <LocationsSection
        locations={customer.locations}
        customerId={customer.id}
        canManageLocations={canManageLocations}
      />
      <QuotesSection quotes={customer.quotes} now={now} />
      <ActivityTimeline events={activity} now={now} />
    </div>
  );
}
