import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, Card, CardContent, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { getCustomerDetail } from '@/lib/customers';
import { LocationForm } from '@/components/customers/location-form';

interface NewLocationPageParams {
  readonly customerId: string;
}

export const metadata: Metadata = { title: 'New location' };

/** Add a site to a customer. Gated on `LOCATION_MANAGE`; the service re-checks. */
export default async function NewLocationPage({
  params,
}: {
  params: Promise<NewLocationPageParams>;
}) {
  const { customerId } = await params;
  await requirePagePermission(Permission.LOCATION_MANAGE);

  const customer = await getCustomerDetail(customerId).catch((error: unknown) => {
    if (isAppError(error, ErrorCode.NOT_FOUND)) notFound();
    throw error;
  });

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: customer.companyName, href: `/customers/${customer.id}` },
          { label: 'New location' },
        ]}
      />

      <PageHeader title={`New location — ${customer.companyName}`} />

      <Card>
        <CardContent>
          <LocationForm mode="create" customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  );
}
