'use client';

import { CircleAlert, CircleCheck, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { type ValidationFinding, ValidationSeverity } from '@nexora/types';

import { cn } from '../cn';

export interface FindingsPanelProps {
  readonly findings: readonly ValidationFinding[];
  /** Called when the user accepts a one-click remedy. */
  readonly onApplyRemedy: (finding: ValidationFinding) => void;
  readonly productNames: ReadonlyMap<string, string>;
}

/**
 * Live configuration feedback.
 *
 * The five severities are rendered distinctly (§14) because they mean genuinely
 * different things to a salesperson: an ERROR stops the quote, a REQUIRED tells
 * them what to add, a RECOMMENDATION is advice they may decline, and INFORMATION
 * is context. Rendering them all as "warnings" would train people to ignore the
 * ones that matter.
 */

const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  [ValidationSeverity.ERROR]: 0,
  [ValidationSeverity.REQUIRED]: 1,
  [ValidationSeverity.WARNING]: 2,
  [ValidationSeverity.RECOMMENDATION]: 3,
  [ValidationSeverity.INFORMATION]: 4,
};

const SEVERITY_STYLE: Record<
  ValidationSeverity,
  { readonly icon: typeof CircleAlert; readonly className: string; readonly label: string }
> = {
  [ValidationSeverity.ERROR]: {
    icon: CircleAlert,
    className:
      'border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
    label: 'Error',
  },
  [ValidationSeverity.REQUIRED]: {
    icon: CircleAlert,
    className:
      'border-[var(--color-warning-200)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
    label: 'Required',
  },
  [ValidationSeverity.WARNING]: {
    icon: TriangleAlert,
    className:
      'border-[var(--color-warning-200)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
    label: 'Warning',
  },
  [ValidationSeverity.RECOMMENDATION]: {
    icon: Lightbulb,
    className:
      'border-[var(--color-info-200)] bg-[var(--color-info-50)] text-[var(--color-info-700)]',
    label: 'Recommended',
  },
  [ValidationSeverity.INFORMATION]: {
    icon: Info,
    className: 'border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
    label: 'Information',
  },
};

function remedyLabel(
  finding: ValidationFinding,
  productNames: ReadonlyMap<string, string>,
): string | null {
  if (!finding.remedy) return null;

  switch (finding.remedy.kind) {
    case 'ADD_PRODUCT':
      return `Add ${productNames.get(finding.remedy.productId) ?? 'the required product'}`;
    case 'REMOVE_PRODUCT':
      return `Remove ${productNames.get(finding.remedy.productId) ?? 'the conflicting product'}`;
    case 'SET_CONTRACT_MONTHS':
      return `Set the term to ${finding.remedy.months} months`;
    default:
      return null;
  }
}

export function FindingsPanel({ findings, onApplyRemedy, productNames }: FindingsPanelProps) {
  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-3 py-2.5 text-sm text-[var(--color-success-700)]">
        <CircleCheck className="size-4 shrink-0" aria-hidden />
        This configuration is valid.
      </div>
    );
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <ul className="space-y-2" aria-live="polite" aria-label="Configuration issues">
      {sorted.map((finding) => {
        const style = SEVERITY_STYLE[finding.severity];
        const Icon = style.icon;
        const action = remedyLabel(finding, productNames);

        return (
          <li
            key={finding.ruleId}
            className={cn('rounded-md border px-3 py-2.5 text-sm', style.className)}
          >
            <div className="flex gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold uppercase tracking-wider opacity-80">
                  {style.label}
                </p>
                <p className="mt-0.5 leading-snug">{finding.message}</p>

                {action ? (
                  <button
                    type="button"
                    onClick={() => onApplyRemedy(finding)}
                    className="mt-1.5 rounded-sm text-xs font-medium underline underline-offset-2 hover:no-underline"
                  >
                    {action}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
