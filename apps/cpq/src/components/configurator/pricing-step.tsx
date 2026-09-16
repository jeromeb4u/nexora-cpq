'use client';

import {
  type ContractTerm,
  type DiscountEvaluation,
  type PriceBreakdown,
  CONTRACT_TERMS,
  bpsToRate,
  cents,
  formatMoney,
  formatRate,
  rateToBps,
} from '@nexora/types';
import { Field, Textarea } from '@nexora/ui';

import { cn } from '../cn';

export interface PricingStepProps {
  readonly contractMonths: ContractTerm;
  readonly onContractMonthsChange: (months: ContractTerm) => void;
  readonly discountBps: number;
  readonly onDiscountBpsChange: (bps: number) => void;
  readonly discountReason: string;
  readonly onDiscountReasonChange: (reason: string) => void;
  readonly evaluation: DiscountEvaluation;
  readonly price: PriceBreakdown;
}

/**
 * Term and discount.
 *
 * The discount control goes past the user's own authority on purpose. Capping
 * the slider at their limit would hide the escalation path entirely; letting
 * them ask for more, and explaining immediately who would have to approve it,
 * is both more honest and the behaviour the approval workflow exists for.
 * The server clamps regardless (§33) — this control cannot grant anything.
 */
export function PricingStep({
  contractMonths,
  onContractMonthsChange,
  discountBps,
  onDiscountBpsChange,
  discountReason,
  onDiscountReasonChange,
  evaluation,
  price,
}: PricingStepProps) {
  const maxSelectableBps = 3_500;
  const authorityBps = rateToBps(evaluation.roleMaxRate);
  const withinAuthority = discountBps <= authorityBps;
  const needsReason = discountBps > 0;
  const reasonTooShort = needsReason && discountReason.trim().length < 10;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-[var(--text-primary)]">Contract term</legend>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Longer commitments earn an automatic discount and change what the catalogue allows.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {CONTRACT_TERMS.map((term) => {
            const active = term === contractMonths;
            return (
              <button
                key={term}
                type="button"
                onClick={() => onContractMonthsChange(term)}
                aria-pressed={active}
                className={cn(
                  'tabular rounded-md border px-3 py-2 text-sm transition-colors',
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] font-medium text-[var(--text-link)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                )}
              >
                {term} months
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="border-t border-[var(--border-subtle)] pt-5">
        <legend className="text-sm font-medium text-[var(--text-primary)]">
          Negotiated discount
        </legend>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Applied to recurring charges only. Setup fees are cost recovery and are not
          discountable.
        </p>

        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={maxSelectableBps}
            step={50}
            value={discountBps}
            onChange={(event) => onDiscountBpsChange(Number(event.target.value))}
            aria-label="Negotiated discount percentage"
            aria-describedby="discount-explanation"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--surface-sunken)] accent-[var(--accent-solid)]"
          />
          <output
            className={cn(
              'tabular w-20 rounded-md border px-2 py-1.5 text-center text-sm font-semibold',
              withinAuthority
                ? 'border-[var(--border-subtle)] text-[var(--text-primary)]'
                : 'border-[var(--color-warning-200)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
            )}
          >
            {formatRate(bpsToRate(discountBps))}
          </output>
        </div>

        <div className="tabular mt-1 flex justify-between text-2xs text-[var(--text-tertiary)]">
          <span>0%</span>
          <span>Your limit: {formatRate(evaluation.roleMaxRate)}</span>
          <span>{formatRate(bpsToRate(maxSelectableBps))}</span>
        </div>

        <p
          id="discount-explanation"
          className={cn(
            'mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed',
            evaluation.exceedsAllRoles
              ? 'border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]'
              : evaluation.requiresApproval
                ? 'border-[var(--color-warning-200)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]'
                : 'border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]',
          )}
        >
          {evaluation.explanation}
        </p>

        {discountBps > 0 ? (
          <p className="tabular mt-2 text-xs text-[var(--text-secondary)]">
            Saves the customer {formatMoney(cents(price.discountMonthly))} per month —{' '}
            {formatMoney(cents(price.discountMonthly * price.contractMonths))} over the term.
          </p>
        ) : null}
      </fieldset>

      {needsReason ? (
        <div className="border-t border-[var(--border-subtle)] pt-5">
          <Field
            label="Why is this discount justified?"
            required
            description="At least 10 characters. Approvers read this verbatim, and it stays on the audit trail."
            error={
              reasonTooShort && discountReason.length > 0
                ? 'Give an approver something to act on — at least 10 characters.'
                : undefined
            }
          >
            <Textarea
              rows={3}
              value={discountReason}
              onChange={(event) => onDiscountReasonChange(event.target.value)}
              placeholder="Competitive bid against the incumbent, who has quoted aggressively on a like-for-like package."
              maxLength={1000}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
