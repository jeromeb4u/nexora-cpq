import type { Metadata } from 'next';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { ProductForm } from '@/components/product-catalogue/product-form';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requirePagePermission(Permission.PRODUCT_MANAGE);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Products', href: '/products' }, { label: 'New product' }]} />
      <PageHeader
        title="New product"
        description="Everything a rep can put on a quote starts here."
      />
      <ProductForm mode="create" />
    </div>
  );
}
