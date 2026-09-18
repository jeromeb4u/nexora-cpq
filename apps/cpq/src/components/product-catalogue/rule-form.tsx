'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Field,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
} from '@nexora/ui';
import {
  CONTRACT_TERMS,
  PRODUCT_CATEGORIES,
  RULE_EFFECT_KINDS,
  RULE_TRIGGER_KINDS,
  SERVICEABILITIES,
  VALIDATION_SEVERITIES,
  type ProductCategory,
  type RuleEffectKind,
  type RuleTriggerKind,
  type Serviceability,
  type ValidationSeverity,
} from '@nexora/types';

import { createRule, updateRule } from '@/lib/actions/catalogue-actions';
import { CATEGORY_LABELS } from './labels';
import { describeRule } from './rule-summary';

export interface RuleProductOption {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly isActive: boolean;
}

export interface RuleDefaultValues {
  readonly id: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly priority: number;
  readonly isActive: boolean;
  readonly triggerKind: RuleTriggerKind;
  readonly triggerProductId: string | null;
  readonly triggerCategory: ProductCategory | null;
  readonly triggerThreshold: number | null;
  readonly effectKind: RuleEffectKind;
  readonly effectProductId: string | null;
  readonly effectThreshold: number | null;
  readonly effectServiceability: Serviceability | null;
  readonly targetProductIds: readonly string[];
}

export interface RuleFormProps {
  readonly mode: 'create' | 'edit';
  readonly products: readonly RuleProductOption[];
  readonly defaultValues?: RuleDefaultValues;
}

const TRIGGER_LABELS: Record<RuleTriggerKind, string> = {
  PRODUCT_SELECTED: 'A specific product is selected',
  CATEGORY_SELECTED: 'Any product of a category is selected',
  BANDWIDTH_AT_LEAST: 'Connectivity reaches a bandwidth',
  CONTRACT_TERM_AT_LEAST: 'The contract term reaches a length',
  ALWAYS: 'Always',
};

const EFFECT_LABELS: Record<RuleEffectKind, string> = {
  REQUIRES_PRODUCT: 'Require a product',
  REQUIRES_ONE_OF: 'Require one of a group',
  INCOMPATIBLE_WITH_PRODUCT: 'Forbid a product',
  RECOMMENDS_PRODUCT: 'Recommend a product',
  AT_MOST_ONE_OF: 'Allow at most one of a group',
  MIN_CONTRACT_MONTHS: 'Require a minimum contract term',
  MIN_SERVICEABILITY: 'Require a minimum serviceability',
};

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  ERROR: 'Error — blocks saving and submission',
  REQUIRED: 'Required — must be actioned, does not block',
  WARNING: 'Warning — risky but allowed',
  RECOMMENDATION: 'Recommendation — an upsell or best practice',
  INFORMATION: 'Information — context only',
};

const SERVICEABILITY_LABELS: Record<Serviceability, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited',
  UNAVAILABLE: 'Unavailable',
  PENDING_CHECK: 'Pending check',
};

const SINGLE_PRODUCT_EFFECTS: readonly RuleEffectKind[] = [
  'REQUIRES_PRODUCT',
  'INCOMPATIBLE_WITH_PRODUCT',
  'RECOMMENDS_PRODUCT',
];
const GROUP_EFFECTS: readonly RuleEffectKind[] = ['REQUIRES_ONE_OF', 'AT_MOST_ONE_OF'];

/**
 * The rule editor.
 *
 * A rule is a trigger and an effect, and each kind needs different parameters —
 * so the form shows only the inputs that kind uses, and previews the finished
 * rule as the sentence a sales rep would read. The same Zod schema that backs
 * this form runs again on the server; nothing here is the enforcement.
 */
export function RuleForm({ mode, products, defaultValues }: RuleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<ValidationSeverity>(defaultValues?.severity ?? 'ERROR');
  const [message, setMessage] = useState(defaultValues?.message ?? '');
  const [priority, setPriority] = useState(String(defaultValues?.priority ?? 100));
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);

  const [triggerKind, setTriggerKind] = useState<RuleTriggerKind>(
    defaultValues?.triggerKind ?? 'PRODUCT_SELECTED',
  );
  const [triggerProductId, setTriggerProductId] = useState(defaultValues?.triggerProductId ?? '');
  const [triggerCategory, setTriggerCategory] = useState<ProductCategory>(
    defaultValues?.triggerCategory ?? 'CONNECTIVITY',
  );
  const [triggerThreshold, setTriggerThreshold] = useState(
    defaultValues?.triggerThreshold ? String(defaultValues.triggerThreshold) : '',
  );

  const [effectKind, setEffectKind] = useState<RuleEffectKind>(
    defaultValues?.effectKind ?? 'REQUIRES_PRODUCT',
  );
  const [effectProductId, setEffectProductId] = useState(defaultValues?.effectProductId ?? '');
  const [effectThreshold, setEffectThreshold] = useState(
    String(defaultValues?.effectThreshold ?? 36),
  );
  const [effectServiceability, setEffectServiceability] = useState<Serviceability>(
    defaultValues?.effectServiceability ?? 'AVAILABLE',
  );
  const [targetProductIds, setTargetProductIds] = useState<readonly string[]>(
    defaultValues?.targetProductIds ?? [],
  );

  const nameOf = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  const preview = describeRule({
    triggerKind,
    triggerProductName: nameOf.get(triggerProductId) ?? null,
    triggerCategory,
    triggerThreshold: triggerThreshold === '' ? null : Number(triggerThreshold),
    effectKind,
    effectProductName: nameOf.get(effectProductId) ?? null,
    effectThreshold: Number(effectThreshold),
    effectServiceability,
    targetProductNames: targetProductIds.flatMap((id) => {
      const name = nameOf.get(id);
      return name ? [name] : [];
    }),
  });

  function toggleTarget(productId: string, checked: boolean) {
    setTargetProductIds((current) =>
      checked ? [...current, productId] : current.filter((id) => id !== productId),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const payload = {
      ...(mode === 'edit' && defaultValues ? { id: defaultValues.id } : {}),
      severity,
      message: message.trim(),
      priority: Number(priority),
      isActive,
      triggerKind,
      triggerProductId:
        triggerKind === 'PRODUCT_SELECTED' ? triggerProductId || undefined : undefined,
      triggerCategory: triggerKind === 'CATEGORY_SELECTED' ? triggerCategory : undefined,
      triggerThreshold:
        triggerKind === 'BANDWIDTH_AT_LEAST' || triggerKind === 'CONTRACT_TERM_AT_LEAST'
          ? Number(triggerThreshold)
          : undefined,
      effectKind,
      effectProductId: SINGLE_PRODUCT_EFFECTS.includes(effectKind)
        ? effectProductId || undefined
        : undefined,
      effectThreshold: effectKind === 'MIN_CONTRACT_MONTHS' ? Number(effectThreshold) : undefined,
      effectServiceability: effectKind === 'MIN_SERVICEABILITY' ? effectServiceability : undefined,
      targetProductIds: GROUP_EFFECTS.includes(effectKind) ? targetProductIds : [],
    };

    startTransition(async () => {
      const result = mode === 'create' ? await createRule(payload) : await updateRule(payload);

      if (result.ok) {
        toast.success(mode === 'create' ? 'Rule added' : 'Rule updated');
        router.push('/products/rules');
        router.refresh();
      } else {
        setServerError(`${result.message} (reference ${result.reference})`);
      }
    });
  }

  const productOptions = products.map((product) => (
    <option key={product.id} value={product.id}>
      {product.sku} — {product.name}
      {product.isActive ? '' : ' (withdrawn)'}
    </option>
  ));

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {serverError ? (
            <Alert variant="danger" title="Could not save this rule">
              {serverError}
            </Alert>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">When it fires</h2>

            <Field label="Trigger" required>
              <Select
                value={triggerKind}
                onChange={(event) => setTriggerKind(event.target.value as RuleTriggerKind)}
              >
                {RULE_TRIGGER_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TRIGGER_LABELS[kind]}
                  </option>
                ))}
              </Select>
            </Field>

            {triggerKind === 'PRODUCT_SELECTED' ? (
              <Field label="Trigger product" required>
                <Select
                  value={triggerProductId}
                  onChange={(event) => setTriggerProductId(event.target.value)}
                >
                  <option value="">Select a product…</option>
                  {productOptions}
                </Select>
              </Field>
            ) : null}

            {triggerKind === 'CATEGORY_SELECTED' ? (
              <Field label="Trigger category" required>
                <Select
                  value={triggerCategory}
                  onChange={(event) => setTriggerCategory(event.target.value as ProductCategory)}
                >
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {triggerKind === 'BANDWIDTH_AT_LEAST' || triggerKind === 'CONTRACT_TERM_AT_LEAST' ? (
              <Field
                label={
                  triggerKind === 'BANDWIDTH_AT_LEAST'
                    ? 'Bandwidth (Mbps)'
                    : 'Contract term (months)'
                }
                required
                description={
                  triggerKind === 'BANDWIDTH_AT_LEAST'
                    ? 'The rule fires when the fastest selected circuit reaches this.'
                    : 'The rule fires at this term or longer.'
                }
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={triggerThreshold}
                  onChange={(event) => setTriggerThreshold(event.target.value)}
                  required
                />
              </Field>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">What it asserts</h2>

            <Field label="Effect" required>
              <Select
                value={effectKind}
                onChange={(event) => setEffectKind(event.target.value as RuleEffectKind)}
              >
                {RULE_EFFECT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {EFFECT_LABELS[kind]}
                  </option>
                ))}
              </Select>
            </Field>

            {SINGLE_PRODUCT_EFFECTS.includes(effectKind) ? (
              <Field label="Product" required>
                <Select
                  value={effectProductId}
                  onChange={(event) => setEffectProductId(event.target.value)}
                >
                  <option value="">Select a product…</option>
                  {productOptions}
                </Select>
              </Field>
            ) : null}

            {GROUP_EFFECTS.includes(effectKind) ? (
              <Field
                label="Product group"
                required
                description="Choose at least two products. A group of one is not a choice."
              >
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--border-subtle)] p-2">
                  {products.map((product) => {
                    const checked = targetProductIds.includes(product.id);
                    return (
                      <div key={product.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`target-${product.id}`}
                          checked={checked}
                          onCheckedChange={(next) => toggleTarget(product.id, next === true)}
                        />
                        <Label htmlFor={`target-${product.id}`} className="text-xs font-normal">
                          {product.sku} — {product.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </Field>
            ) : null}

            {effectKind === 'MIN_CONTRACT_MONTHS' ? (
              <Field label="Minimum term" required>
                <Select
                  value={effectThreshold}
                  onChange={(event) => setEffectThreshold(event.target.value)}
                >
                  {CONTRACT_TERMS.map((months) => (
                    <option key={months} value={months}>
                      {months} months
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {effectKind === 'MIN_SERVICEABILITY' ? (
              <Field label="Minimum serviceability" required>
                <Select
                  value={effectServiceability}
                  onChange={(event) =>
                    setEffectServiceability(event.target.value as Serviceability)
                  }
                >
                  {SERVICEABILITIES.map((level) => (
                    <option key={level} value={level}>
                      {SERVICEABILITY_LABELS[level]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              How it is presented
            </h2>

            <Field
              label="Message"
              required
              description="Shown to the sales rep exactly as written. Say what to do, not what went wrong."
            >
              <Textarea
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                placeholder="Connectivity of 10 Gbps requires an Enterprise Router."
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Severity" required>
                <Select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as ValidationSeverity)}
                >
                  {VALIDATION_SEVERITIES.map((level) => (
                    <option key={level} value={level}>
                      {SEVERITY_LABELS[level]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority" description="Lower runs first.">
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  step="1"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                />
              </Field>

              <Field
                label="Active"
                description={isActive ? 'Evaluated on every configuration.' : 'Never fires.'}
              >
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </Field>
            </div>
          </section>

          <Alert variant="info" title="This rule reads as">
            {preview}
          </Alert>

          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button type="button" variant="ghost" asChild>
              <Link href="/products/rules">Cancel</Link>
            </Button>
            <Button type="submit" isLoading={isPending}>
              {mode === 'create' ? 'Add rule' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
