import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  Breadcrumbs,
  Button,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';
import { Permission, can } from '@nexora/auth/permissions';
import type { ValidationSeverity } from '@nexora/types';

import { requirePagePermission } from '@/lib/session';
import { listRules } from '@/lib/rules';
import { describeRule } from '@/components/product-catalogue/rule-summary';
import { RuleActiveToggle } from '@/components/product-catalogue/rule-active-toggle';

export const metadata: Metadata = { title: 'Configuration rules' };

const SEVERITY_TONE: Record<ValidationSeverity, 'danger' | 'warning' | 'brand' | 'neutral'> = {
  ERROR: 'danger',
  REQUIRED: 'warning',
  WARNING: 'warning',
  RECOMMENDATION: 'brand',
  INFORMATION: 'neutral',
};

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  ERROR: 'Error',
  REQUIRED: 'Required',
  WARNING: 'Warning',
  RECOMMENDATION: 'Recommendation',
  INFORMATION: 'Information',
};

/**
 * Every compatibility rule, as sentences.
 *
 * Rules are data, so this page is the whole rule engine's content: what fires,
 * what it asserts, how loudly, and in what order. Only ERROR rules block a
 * quote; the rest inform (docs/CPQ-RULES.md).
 */
export default async function RulesPage() {
  const actor = await requirePagePermission(Permission.PRODUCT_READ);
  const canManage = can(actor.role, Permission.RULE_MANAGE);
  const rules = await listRules();

  const active = rules.filter((rule) => rule.isActive).length;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Products', href: '/products' }, { label: 'Rules' }]} />

      <PageHeader
        title="Configuration rules"
        description={`${active} of ${rules.length} rules are active. Rules are evaluated in priority order, lowest first.`}
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/products/rules/new">New rule</Link>
            </Button>
          ) : null
        }
      />

      {rules.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10">
          <EmptyState
            title="No rules yet"
            description="Rules describe which products need, exclude or recommend each other."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Active</TableHead>
                {canManage ? (
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} className={rule.isActive ? undefined : 'opacity-60'}>
                  <TableCell className="max-w-xl">
                    <span className="block text-[var(--text-primary)]">{describeRule(rule)}</span>
                    <span className="text-2xs mt-0.5 block text-[var(--text-tertiary)]">
                      Shown as: “{rule.message}”
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={SEVERITY_TONE[rule.severity]}>
                      {SEVERITY_LABELS[rule.severity]}
                    </Badge>
                  </TableCell>
                  <TableCellNumeric className="text-[var(--text-secondary)]">
                    {rule.priority}
                  </TableCellNumeric>
                  <TableCell>
                    {canManage ? (
                      <RuleActiveToggle ruleId={rule.id} isActive={rule.isActive} />
                    ) : (
                      <Badge tone={rule.isActive ? 'success' : 'neutral'}>
                        {rule.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/products/rules/${rule.id}/edit`}>Edit</Link>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
