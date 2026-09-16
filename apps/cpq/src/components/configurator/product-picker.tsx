'use client';

import { Check, Lock, Minus, Plus } from 'lucide-react';
import { type ProductSnapshot, PricingModel, cents, formatMoney } from '@nexora/types';

import { cn } from '../cn';

export interface ProductPickerProps {
  readonly products: readonly ProductSnapshot[];
  readonly selections: ReadonlyMap<string, number>;
  readonly requiredProductIds: ReadonlySet<string>;
  readonly conflictingProductIds: ReadonlySet<string>;
  readonly onToggle: (productId: string) => void;
  readonly onQuantityChange: (productId: string, quantity: number) => void;
  readonly disabled?: boolean;
}

/**
 * Product selection for one catalogue category.
 *
 * Products the rules currently REQUIRE are marked, and ones that would conflict
 * with the present selection are marked too — so the consequence of a choice is
 * visible before it is made rather than reported afterwards as an error.
 *
 * A conflicting product is not disabled. Blocking the click would leave the
 * user guessing why; letting them select it and immediately explaining what
 * broke, with a one-click remedy, teaches the rule instead of hiding it.
 */
export function ProductPicker({
  products,
  selections,
  requiredProductIds,
  conflictingProductIds,
  onToggle,
  onQuantityChange,
  disabled = false,
}: ProductPickerProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--border-default)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
        Nothing available in this category.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {products.map((product) => {
        const quantity = selections.get(product.id);
        const selected = quantity !== undefined;
        const required = requiredProductIds.has(product.id) && !selected;
        const conflicting = conflictingProductIds.has(product.id) && selected;
        const perUnit = product.pricingModel === PricingModel.PER_UNIT;

        return (
          <li key={product.id}>
            <div
              className={cn(
                'rounded-lg border p-3 transition-colors',
                selected
                  ? 'border-[var(--accent-border)] bg-[var(--surface-selected)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
                conflicting && 'border-[var(--color-danger-200)] bg-[var(--color-danger-50)]',
                required && 'border-[var(--color-warning-200)]',
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`${selected ? 'Remove' : 'Add'} ${product.name}`}
                  disabled={disabled}
                  onClick={() => onToggle(product.id)}
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                    selected
                      ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)] text-[var(--text-inverse)]'
                      : 'border-[var(--border-strong)] bg-[var(--surface-raised)]',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {selected ? <Check className="size-3" aria-hidden /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {product.name}
                    </span>
                    <span className="font-mono text-2xs text-[var(--text-tertiary)]">
                      {product.sku}
                    </span>
                    {required ? (
                      <span className="rounded-full bg-[var(--color-warning-50)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--color-warning-700)]">
                        Required
                      </span>
                    ) : null}
                    {conflicting ? (
                      <span className="rounded-full bg-[var(--color-danger-50)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--color-danger-700)]">
                        Conflict
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {describe(product)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-medium text-[var(--text-primary)]">
                    {formatMoney(cents(product.monthlyPrice))}
                    <span className="text-2xs font-normal text-[var(--text-tertiary)]">/mo</span>
                  </p>
                  {product.setupPrice > 0 ? (
                    <p className="tabular text-2xs text-[var(--text-tertiary)]">
                      + {formatMoney(cents(product.setupPrice))} setup
                    </p>
                  ) : null}
                </div>
              </div>

              {selected && perUnit ? (
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-xs text-[var(--text-secondary)]">Quantity</span>
                  <div className="flex items-center gap-1">
                    <QuantityButton
                      label={`Decrease ${product.name} quantity`}
                      disabled={disabled || (quantity ?? 1) <= 1}
                      onClick={() => onQuantityChange(product.id, Math.max(1, (quantity ?? 1) - 1))}
                    >
                      <Minus className="size-3" aria-hidden />
                    </QuantityButton>
                    <span className="tabular w-8 text-center text-sm text-[var(--text-primary)]">
                      {quantity ?? 1}
                    </span>
                    <QuantityButton
                      label={`Increase ${product.name} quantity`}
                      disabled={disabled || (quantity ?? 1) >= 999}
                      onClick={() => onQuantityChange(product.id, Math.min(999, (quantity ?? 1) + 1))}
                    >
                      <Plus className="size-3" aria-hidden />
                    </QuantityButton>
                  </div>
                </div>
              ) : null}

              {selected && product.pricingModel === PricingModel.PER_SITE ? (
                <p className="mt-2 flex items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2 text-2xs text-[var(--text-tertiary)]">
                  <Lock className="size-3" aria-hidden />
                  Billed once per site — quantity follows the site count.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuantityButton({
  label,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function describe(product: ProductSnapshot): string {
  const parts: string[] = [];

  if (product.bandwidthMbps !== null) {
    parts.push(
      product.bandwidthMbps >= 1000
        ? `${product.bandwidthMbps / 1000} Gbps`
        : `${product.bandwidthMbps} Mbps`,
    );
  }

  parts.push(`Minimum ${product.minContractMonths} months`);

  if (product.pricingModel === PricingModel.PER_UNIT) parts.push('Priced per unit');
  if (product.pricingModel === PricingModel.PER_SITE) parts.push('Priced per site');

  return parts.join(' · ');
}
