import type { Metadata } from 'next';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { listProductOptions } from '@/lib/rules';
import { RuleForm } from '@/components/product-catalogue/rule-form';

export const metadata: Metadata = { title: 'New rule' };

export default async function NewRulePage() {
  await requirePagePermission(Permission.RULE_MANAGE);
  const products = await listProductOptions();

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Products', href: '/products' },
          { label: 'Rules', href: '/products/rules' },
          { label: 'New rule' },
        ]}
      />
      <PageHeader
        title="New rule"
        description="Rules are evaluated in the configurator and again on the server when a quote is saved."
      />
      <RuleForm mode="create" products={products} />
    </div>
  );
}
