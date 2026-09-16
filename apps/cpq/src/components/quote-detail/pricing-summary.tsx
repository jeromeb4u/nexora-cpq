import { Card, CardContent, CardHeader, CardTitle } from '@nexora/ui';
import { bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';

export interface PricingSummaryVersion {
  readonly grossMonthlyCents: number;
  readonly discountMonthlyCents: number;
  readonly mrrCents: number;
  readonly otcCents: number;
  readonly tcvCents: number;
  readonly contractMonths: number;
  readonly effectiveDiscountBps: number;
}

export interface PricingSummaryProps {
  readonly version: PricingSummaryVersion | null;
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      <span className="tabular flex items-baseline gap-1.5 text-sm text-[var(--text-primary)]">
        {value}
        {hint ? <span className="text-2xs text-[var(--text-tertiary)]">{hint}</span> : null}
      </span>
    </div>
  );
}

/**
 * The number people open the quote to see. Final MRR and TCV are rendered at
 * a distinctly larger scale than every other figure in this card — the rest
 * is supporting detail, not competing headline data.
 */
export function PricingSummary({ version }: PricingSummaryProps) {
  if (!version) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--text-tertiary)]">
            This quote has no priced version yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md bg-[var(--surface-selected)] px-3 py-3">
          <p className="text-2xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Final MRR
          </p>
          <p className="tabular mt-0.5 text-2xl font-semibold text-[var(--text-primary)]">
            {formatMoney(cents(version.mrrCents))}
          </p>
        </div>

        <div className="rounded-md border border-[var(--border-subtle)] px-3 py-3">
          <p className="text-2xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Total contract value
          </p>
          <p className="tabular mt-0.5 text-xl font-semibold text-[var(--text-primary)]">
            {formatMoney(cents(version.tcvCents))}
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
          <Row label="Gross MRR" value={formatMoney(cents(version.grossMonthlyCents))} />
          <Row
            label="Total discount"
            value={`− ${formatMoney(cents(version.discountMonthlyCents))}`}
            hint={
              version.effectiveDiscountBps > 0
                ? formatRate(bpsToRate(version.effectiveDiscountBps))
                : undefined
            }
          />
          <Row label="One-time charges" value={formatMoney(cents(version.otcCents))} />
          <Row label="Contract term" value={`${version.contractMonths} months`} />
        </div>
      </CardContent>
    </Card>
  );
}
