import type { Metadata } from 'next';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { listCustomersForPicker } from '@/lib/customers';
import { NewQuoteForm } from '@/components/new-quote-form';

export const metadata: Metadata = { title: 'New quote' };

export default async function NewQuotePage() {
  await requirePagePermission(Permission.QUOTE_CREATE);
  const customers = await listCustomersForPicker();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Breadcrumbs items={[{ label: 'Quotes', href: '/quotes' }, { label: 'New quote' }]} />
      <PageHeader
        title="New quote"
        description="Identify the customer and site. Products, term and pricing come next."
      />
      <NewQuoteForm customers={customers} />
    </div>
  );
}
