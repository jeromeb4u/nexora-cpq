import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Breadcrumbs, Card, CardContent, CardHeader, CardTitle, DataList, DataListItem, PageHeader, StatusBadge } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
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
  const customer = await loadCustomer(customerId);
  const activity = await getCustomerActivity(customer.id);

  const now = requestInstant();

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
              <a href={`mailto:${customer.email}`} className="text-[var(--text-link)] hover:underline">
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
            <DataListItem label="Created">{customer.createdAt.toLocaleDateString('en-GB')}</DataListItem>
          </DataList>
        </CardContent>
      </Card>

      <LocationsSection locations={customer.locations} />
      <QuotesSection quotes={customer.quotes} now={now} />
      <ActivityTimeline events={activity} now={now} />
    </div>
  );
}
