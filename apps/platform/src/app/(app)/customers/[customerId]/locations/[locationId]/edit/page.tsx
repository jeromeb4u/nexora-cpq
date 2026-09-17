import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, Card, CardContent, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { getCustomerDetail } from '@/lib/customers';
import { LocationForm } from '@/components/customers/location-form';

interface EditLocationPageParams {
  readonly customerId: string;
  readonly locationId: string;
}

export const metadata: Metadata = { title: 'Edit location' };

/**
 * Edit a customer site. Gated on `LOCATION_MANAGE`; the service re-checks.
 *
 * The location is looked up as a member of `customer.locations` rather than
 * by its own id directly — a location id from the URL is only a claim, and
 * one that belongs to a different customer must 404 exactly like one that
 * does not exist at all (§26), never leak as "wrong customer".
 */
export default async function EditLocationPage({
  params,
}: {
  params: Promise<EditLocationPageParams>;
}) {
  const { customerId, locationId } = await params;
  await requirePagePermission(Permission.LOCATION_MANAGE);

  const customer = await getCustomerDetail(customerId).catch((error: unknown) => {
    if (isAppError(error, ErrorCode.NOT_FOUND)) notFound();
    throw error;
  });

  const location = customer.locations.find((candidate) => candidate.id === locationId);
  if (!location) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: customer.companyName, href: `/customers/${customer.id}` },
          { label: `Edit ${location.name}` },
        ]}
      />

      <PageHeader title={`Edit ${location.name}`} description={customer.companyName} />

      <Card>
        <CardContent>
          <LocationForm
            mode="edit"
            customerId={customer.id}
            locationId={location.id}
            defaultValues={{
              name: location.name,
              addressLine1: location.addressLine1,
              addressLine2: location.addressLine2,
              city: location.city,
              postalCode: location.postalCode,
              country: location.country,
              contactName: location.contactName,
              contactEmail: location.contactEmail,
              contactPhone: location.contactPhone,
              existingConnectivity: location.existingConnectivity,
              serviceability: location.serviceability,
              maxBandwidthMbps: location.maxBandwidthMbps,
              isPrimary: location.isPrimary,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
