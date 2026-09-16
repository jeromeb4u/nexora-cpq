'use client';

import { Check } from 'lucide-react';

import { cn } from '../cn';
import { STEPS, type StepId, stepIndex } from './steps';

export interface StepNavProps {
  readonly current: StepId;
  readonly onNavigate: (step: StepId) => void;
  readonly hasSelections: boolean;
  readonly isValid: boolean;
}

/**
 * The step rail.
 *
 * Every step is reachable at any time (§13): a salesperson revisiting
 * connectivity from the review step must not have to click backwards through
 * five pages, and state is held in one place so nothing is lost either way.
 * Steps before the current one are marked complete purely as orientation — the
 * real gate is the validity of the configuration, shown separately.
 */
export function StepNav({ current, onNavigate, hasSelections, isValid }: StepNavProps) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Configuration steps">
      <ol className="space-y-0.5">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          const behind = index < currentIndex;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onNavigate(step.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-[var(--surface-selected)] font-medium text-[var(--text-link)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                )}
              >
                <span
                  className={cn(
                    'tabular flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold',
                    active
                      ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)] text-[var(--text-inverse)]'
                      : behind
                        ? 'border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                        : 'border-[var(--border-default)] text-[var(--text-tertiary)]',
                  )}
                  aria-hidden
                >
                  {behind ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p
        className={cn(
          'mt-3 rounded-md border px-2.5 py-2 text-2xs leading-relaxed',
          !hasSelections
            ? 'border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-tertiary)]'
            : isValid
              ? 'border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
              : 'border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
        )}
      >
        {!hasSelections
          ? 'Nothing selected yet.'
          : isValid
            ? 'Configuration is valid and can be submitted.'
            : 'Configuration has blocking issues.'}
      </p>
    </nav>
  );
}
