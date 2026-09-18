import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';

import { requirePagePermission } from '@/lib/session';
import { getRule, listProductOptions } from '@/lib/rules';
import { RuleForm } from '@/components/product-catalogue/rule-form';

export const metadata: Metadata = { title: 'Edit rule' };

export default async function EditRulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  await requirePagePermission(Permission.RULE_MANAGE);
  const { ruleId } = await params;

  const [rule, products] = await Promise.all([getRule(ruleId), listProductOptions()]);
  if (!rule) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Products', href: '/products' },
          { label: 'Rules', href: '/products/rules' },
          { label: 'Edit rule' },
        ]}
      />
      <PageHeader title="Edit rule" description={rule.message} />
      <RuleForm
        mode="edit"
        products={products}
        defaultValues={{
          id: rule.id,
          severity: rule.severity,
          message: rule.message,
          priority: rule.priority,
          isActive: rule.isActive,
          triggerKind: rule.triggerKind,
          triggerProductId: rule.triggerProductId,
          triggerCategory: rule.triggerCategory,
          triggerThreshold: rule.triggerThreshold,
          effectKind: rule.effectKind,
          effectProductId: rule.effectProductId,
          effectThreshold: rule.effectThreshold,
          effectServiceability: rule.effectServiceability,
          targetProductIds: rule.targets.map((target) => target.productId),
        }}
      />
    </div>
  );
}
