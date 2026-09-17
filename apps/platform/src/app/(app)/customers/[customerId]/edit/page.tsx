import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, Card, CardContent, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';

import { requirePagePermission } from '@/lib/session';
import { getCustomerDetail, listAssignableOwners } from '@/lib/customers';
import { CustomerForm } from '@/components/customers/customer-form';

interface EditCustomerPageParams {
  readonly customerId: string;
}

export const metadata: Metadata = { title: 'Edit customer' };

/** Edit an existing customer. Gated on `CUSTOMER_UPDATE`; the service re-checks. */
export default async function EditCustomerPage({
  params,
}: {
  params: Promise<EditCustomerPageParams>;
}) {
  const { customerId } = await params;
  const actor = await requirePagePermission(Permission.CUSTOMER_UPDATE);

  const [customer, owners] = await Promise.all([
    getCustomerDetail(customerId).catch((error: unknown) => {
      if (isAppError(error, ErrorCode.NOT_FOUND)) notFound();
      throw error;
    }),
    listAssignableOwners(),
  ]);

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: customer.companyName, href: `/customers/${customer.id}` },
          { label: 'Edit' },
        ]}
      />

      <PageHeader title={`Edit ${customer.companyName}`} />

      <Card>
        <CardContent>
          <CustomerForm
            mode="edit"
            actor={{ id: actor.id, role: actor.role }}
            owners={owners}
            customerId={customer.id}
            defaultValues={{
              companyName: customer.companyName,
              legalName: customer.legalName,
              industry: customer.industry,
              vatNumber: customer.vatNumber,
              status: customer.status,
              email: customer.email,
              phone: customer.phone,
              website: customer.website,
              notes: customer.notes,
              accountOwnerId: customer.accountOwnerId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
