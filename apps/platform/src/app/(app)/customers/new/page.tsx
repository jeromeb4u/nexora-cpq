import type { Metadata } from 'next';
import { Breadcrumbs, Card, CardContent, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { listAssignableOwners } from '@/lib/customers';
import { CustomerForm } from '@/components/customers/customer-form';

export const metadata: Metadata = { title: 'New customer' };

/** Create a new customer. Gated on `CUSTOMER_CREATE`; the service re-checks. */
export default async function NewCustomerPage() {
  const actor = await requirePagePermission(Permission.CUSTOMER_CREATE);
  const owners = await listAssignableOwners();

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[{ label: 'Customers', href: '/customers' }, { label: 'New customer' }]}
      />

      <PageHeader title="New customer" />

      <Card>
        <CardContent>
          <CustomerForm mode="create" actor={{ id: actor.id, role: actor.role }} owners={owners} />
        </CardContent>
      </Card>
    </div>
  );
}
