'use client';

import {
  type DiscountEvaluation,
  type PriceBreakdown,
  type ValidationFinding,
  cents,
  formatMoney,
  formatRate,
} from '@nexora/types';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';

export interface ReviewStepProps {
  readonly customerName: string;
  readonly locationName: string | null;
  readonly price: PriceBreakdown;
  readonly findings: readonly ValidationFinding[];
  readonly discountReason: string;
  readonly evaluation: DiscountEvaluation;
}

/**
 * Everything on one page before it leaves the salesperson's hands.
 *
 * Shows the per-line discount explicitly, including where a product's own
 * ceiling held a line below the headline rate — that difference is exactly what
 * a customer queries, and finding out about it after the quote has been sent is
 * worse than seeing it here.
 */
export function ReviewStep({
  customerName,
  locationName,
  price,
  findings,
  discountReason,
  evaluation,
}: ReviewStepProps) {
  const advisory = findings.filter((finding) => !finding.blocking);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 text-sm sm:grid-cols-3">
        <Detail label="Customer" value={customerName} />
        <Detail label="Site" value={locationName ?? 'Not set'} />
        <Detail label="Contract term" value={`${price.contractMonths} months`} />
      </dl>

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit / month</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead className="text-right">Setup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {price.lines.map((line) => (
              <TableRow key={line.productId}>
                <TableCell>
                  <span className="font-medium text-[var(--text-primary)]">{line.name}</span>
                  <span className="block font-mono text-2xs text-[var(--text-tertiary)]">
                    {line.sku}
                  </span>
                </TableCell>
                <TableCellNumeric>{line.quantity}</TableCellNumeric>
                <TableCellNumeric>{formatMoney(cents(line.unitMonthlyPrice))}</TableCellNumeric>
                <TableCellNumeric>
                  {line.appliedDiscountRate > 0 ? (
                    <span
                      className={
                        line.discountCapped ? 'text-[var(--color-warning-700)]' : undefined
                      }
                      title={
                        line.discountCapped
                          ? "Held at this product's own maximum discount"
                          : undefined
                      }
                    >
                      {formatRate(line.appliedDiscountRate)}
                      {line.discountCapped ? ' (capped)' : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCellNumeric>
                <TableCellNumeric>
                  {formatMoney(cents(line.monthlySubtotal - line.discountAmount))}
                </TableCellNumeric>
                <TableCellNumeric>{formatMoney(cents(line.setupSubtotal))}</TableCellNumeric>
              </TableRow>
            ))}
          </TableBody>
          <tfoot className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)]">
            <tr>
              <td className="px-3 py-2.5 text-sm font-medium text-[var(--text-primary)]" colSpan={4}>
                Totals
              </td>
              <td className="tabular px-3 py-2.5 text-right text-sm font-semibold text-[var(--text-primary)]">
                {formatMoney(cents(price.mrr))}
              </td>
              <td className="tabular px-3 py-2.5 text-right text-sm font-semibold text-[var(--text-primary)]">
                {formatMoney(cents(price.otc))}
              </td>
            </tr>
          </tfoot>
        </Table>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Contract value
        </h3>
        <p className="tabular mt-1 text-2xl font-semibold text-[var(--text-primary)]">
          {formatMoney(cents(price.tcv))}
        </p>
        <p className="tabular mt-0.5 text-xs text-[var(--text-secondary)]">
          {formatMoney(cents(price.mrr))} × {price.contractMonths} months +{' '}
          {formatMoney(cents(price.otc))} one-time
        </p>
      </div>

      {discountReason ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Discount justification
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {discountReason}
          </p>
          {evaluation.requiresApproval ? (
            <p className="mt-2 text-2xs text-[var(--color-warning-700)]">
              {evaluation.explanation}
            </p>
          ) : null}
        </div>
      ) : null}

      {advisory.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Advisory notes
          </h3>
          <ul className="mt-2 space-y-1.5">
            {advisory.map((finding) => (
              <li key={finding.ruleId} className="text-xs leading-relaxed text-[var(--text-secondary)]">
                · {finding.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}
