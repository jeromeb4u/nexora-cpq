'use client';

import { type DiscountEvaluation, type PriceBreakdown, cents, formatMoney, formatRate } from '@nexora/types';

import { cn } from '../cn';

export interface PricingPanelProps {
  readonly price: PriceBreakdown;
  readonly evaluation: DiscountEvaluation;
  readonly isValid: boolean;
}

/**
 * The live price, pinned beside the configuration.
 *
 * Shown continuously rather than revealed at a "pricing" step, because the
 * question a salesperson has at every single step is "what does that do to the
 * number". Figures are computed by the same engine the server uses; they are a
 * preview, and the server's recomputation is authoritative.
 */
export function PricingPanel({ price, evaluation, isValid }: PricingPanelProps) {
  const empty = price.lines.length === 0;

  return (
    <aside
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
      aria-label="Live pricing"
    >
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Live pricing
        </h3>
      </div>

      {empty ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
          Select products to see pricing.
        </p>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <Row label="Gross monthly" value={formatMoney(cents(price.grossMonthly))} />

          {price.discounts.map((discount) => (
            <Row
              key={discount.code}
              label={`${discount.label} (${formatRate(discount.rate)})`}
              value={`−${formatMoney(cents(discount.amount))}`}
              tone="discount"
            />
          ))}

          <div className="border-t border-[var(--border-subtle)] pt-3">
            <Row
              label="Monthly recurring"
              value={formatMoney(cents(price.mrr))}
              emphasis
            />
            {price.effectiveDiscountRate > 0 ? (
              <p className="tabular mt-0.5 text-right text-2xs text-[var(--text-tertiary)]">
                Effective discount {formatRate(price.effectiveDiscountRate)}
              </p>
            ) : null}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-3">
            <Row label="One-time charges" value={formatMoney(cents(price.otc))} />
            <Row label="Contract term" value={`${price.contractMonths} months`} />
            <Row label="Total contract value" value={formatMoney(cents(price.tcv))} emphasis />
          </div>

          {evaluation.someLinesCapped ? (
            <p className="rounded-md bg-[var(--surface-sunken)] px-2.5 py-2 text-2xs leading-relaxed text-[var(--text-secondary)]">
              Some products cap their own discount at{' '}
              {formatRate(evaluation.tightestProductRate)}, so the effective rate is below the
              headline one.
            </p>
          ) : null}

          {evaluation.requiresApproval ? (
            <p className="rounded-md border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-2.5 py-2 text-2xs leading-relaxed text-[var(--color-warning-700)]">
              {evaluation.explanation}
            </p>
          ) : null}

          {!isValid ? (
            <p className="rounded-md border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-2.5 py-2 text-2xs leading-relaxed text-[var(--color-danger-700)]">
              This price is provisional — the configuration has blocking issues.
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );
}

function Row({
  label,
  value,
  emphasis = false,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
  readonly tone?: 'discount';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          'text-xs',
          emphasis ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular shrink-0',
          emphasis
            ? 'text-base font-semibold text-[var(--text-primary)]'
            : 'text-sm text-[var(--text-secondary)]',
          tone === 'discount' && 'text-[var(--color-success-600)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}
