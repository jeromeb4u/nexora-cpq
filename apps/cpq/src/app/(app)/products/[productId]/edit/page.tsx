import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { getProduct } from '@/lib/rules';
import { ProductForm } from '@/components/product-catalogue/product-form';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requirePagePermission(Permission.PRODUCT_MANAGE);
  const { productId } = await params;

  const product = await getProduct(productId);
  if (!product) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Products', href: '/products' }, { label: product.sku }]} />
      <PageHeader title={product.name} description={`${product.sku} · editing catalogue entry`} />
      <ProductForm
        mode="edit"
        defaultValues={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          monthlyPriceCents: product.monthlyPriceCents,
          setupPriceCents: product.setupPriceCents,
          pricingModel: product.pricingModel,
          minContractMonths: product.minContractMonths,
          maxDiscountBps: product.maxDiscountBps,
          bandwidthMbps: product.bandwidthMbps,
          isActive: product.isActive,
          sortOrder: product.sortOrder,
        }}
      />
    </div>
  );
}
