'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '@nexora/ui';
import {
  CONTRACT_TERMS,
  PRICING_MODELS,
  PRODUCT_CATEGORIES,
  type PricingModel,
  type ProductCategory,
} from '@nexora/types';

import { createProduct, updateProduct } from '@/lib/actions/catalogue-actions';
import { CATEGORY_LABELS, PRICING_MODEL_LABELS } from './labels';

export interface ProductDefaultValues {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly category: ProductCategory;
  readonly monthlyPriceCents: number;
  readonly setupPriceCents: number;
  readonly pricingModel: PricingModel;
  readonly minContractMonths: number;
  readonly maxDiscountBps: number;
  readonly bandwidthMbps: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface ProductFormProps {
  readonly mode: 'create' | 'edit';
  readonly defaultValues?: ProductDefaultValues;
}

/** Cents in the database, euros in the form — nobody types 249900. */
function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

function eurosToCents(value: string): number {
  return Math.round(Number(value.replace(',', '.')) * 100);
}

/**
 * Create or edit a catalogue product.
 *
 * Prices are entered in euros and stored as integer cents; the discount
 * ceiling is entered as a percentage and stored as basis points. Both
 * conversions happen here, at the boundary, so nothing downstream ever sees a
 * float ([ADR-003](../../../../docs/adr/ADR-003-integer-cents-and-basis-points.md)).
 */
export function ProductForm({ mode, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [sku, setSku] = useState(defaultValues?.sku ?? '');
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [category, setCategory] = useState<ProductCategory>(
    defaultValues?.category ?? 'CONNECTIVITY',
  );
  const [monthly, setMonthly] = useState(centsToEuros(defaultValues?.monthlyPriceCents ?? 0));
  const [setup, setSetup] = useState(centsToEuros(defaultValues?.setupPriceCents ?? 0));
  const [pricingModel, setPricingModel] = useState<PricingModel>(
    defaultValues?.pricingModel ?? 'FLAT',
  );
  const [minContractMonths, setMinContractMonths] = useState(
    String(defaultValues?.minContractMonths ?? 12),
  );
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(
    ((defaultValues?.maxDiscountBps ?? 2000) / 100).toString(),
  );
  const [bandwidth, setBandwidth] = useState(
    defaultValues?.bandwidthMbps ? String(defaultValues.bandwidthMbps) : '',
  );
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(defaultValues?.sortOrder ?? 0));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setFieldError(null);

    const monthlyCents = eurosToCents(monthly);
    const setupCents = eurosToCents(setup);
    const discountBps = Math.round(Number(maxDiscountPercent) * 100);

    if (!Number.isFinite(monthlyCents) || !Number.isFinite(setupCents)) {
      setFieldError('Enter prices as amounts in euro, for example 2499.00.');
      return;
    }
    if (!Number.isFinite(discountBps) || discountBps < 0 || discountBps > 10_000) {
      setFieldError('Enter a maximum discount between 0 and 100 percent.');
      return;
    }

    const trimmedBandwidth = bandwidth.trim();

    const payload = {
      ...(mode === 'edit' && defaultValues ? { id: defaultValues.id } : {}),
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      category,
      monthlyPriceCents: monthlyCents,
      setupPriceCents: setupCents,
      pricingModel,
      minContractMonths: Number(minContractMonths),
      maxDiscountBps: discountBps,
      bandwidthMbps: trimmedBandwidth === '' ? undefined : Number(trimmedBandwidth),
      isActive,
      sortOrder: Number(sortOrder),
    };

    startTransition(async () => {
      const result =
        mode === 'create' ? await createProduct(payload) : await updateProduct(payload);

      if (result.ok) {
        toast.success(mode === 'create' ? 'Product added' : 'Product updated');
        router.push('/products');
        router.refresh();
      } else {
        setServerError(`${result.message} (reference ${result.reference})`);
      }
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {serverError ? (
            <Alert variant="danger" title="Could not save this product">
              {serverError}
            </Alert>
          ) : null}
          {fieldError ? (
            <Alert variant="warning" title="Check these values">
              {fieldError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" required description="Uppercase letters, numbers and hyphens.">
              <Input
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                maxLength={50}
                placeholder="FIB-10G"
                required
              />
            </Field>

            <Field label="Name" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
              />
            </Field>
          </div>

          <Field
            label="Description"
            required
            description="Shown to sales reps in the configurator."
          >
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as ProductCategory)}
              >
                {PRODUCT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Pricing model"
              required
              description="Per unit multiplies by quantity; per site by the number of locations."
            >
              <Select
                value={pricingModel}
                onChange={(event) => setPricingModel(event.target.value as PricingModel)}
              >
                {PRICING_MODELS.map((value) => (
                  <option key={value} value={value}>
                    {PRICING_MODEL_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly price (€)" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthly}
                onChange={(event) => setMonthly(event.target.value)}
                required
              />
            </Field>

            <Field
              label="One-time setup price (€)"
              required
              description="Setup fees are never discounted."
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={setup}
                onChange={(event) => setSetup(event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum contract (months)" required>
              <Select
                value={minContractMonths}
                onChange={(event) => setMinContractMonths(event.target.value)}
              >
                {CONTRACT_TERMS.map((months) => (
                  <option key={months} value={months}>
                    {months} months
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Maximum discount (%)"
              required
              description="This product's own ceiling, applied per line."
            >
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={maxDiscountPercent}
                onChange={(event) => setMaxDiscountPercent(event.target.value)}
                required
              />
            </Field>

            <Field
              label="Bandwidth (Mbps)"
              description="Connectivity only. Rules trigger on this value."
            >
              <Input
                type="number"
                min="1"
                step="1"
                value={bandwidth}
                onChange={(event) => setBandwidth(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sort order" description="Lower numbers appear first within a category.">
              <Input
                type="number"
                step="1"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </Field>

            <Field
              label="Available to sell"
              description={
                isActive
                  ? 'Reps can add this product to a quote.'
                  : 'Withdrawn: quotes that already include it will show an error.'
              }
            >
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button type="button" variant="ghost" asChild>
              <Link href="/products">Cancel</Link>
            </Button>
            <Button type="submit" isLoading={isPending}>
              {mode === 'create' ? 'Add product' : 'Save changes'}
            </Button>
          </div>

          {mode === 'edit' ? (
            <p className="text-2xs text-[var(--text-tertiary)]">
              Price changes apply to quote versions saved from now on. Versions already saved keep
              the prices they were quoted at.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
