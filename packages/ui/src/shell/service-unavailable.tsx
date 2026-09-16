import { CloudOff } from 'lucide-react';

import { Button } from '../components/button';

export interface ServiceUnavailableProps {
  /** Human name of the unreachable service, e.g. "Quoting". */
  readonly serviceName: string;
  /** What the user CAN still do — never show a dead end. */
  readonly availableActions?: readonly { readonly label: string; readonly href: string }[];
  readonly reference?: string;
  readonly onRetry?: () => void;
}

/**
 * Shown when one micro frontend cannot reach the other (§39).
 *
 * The requirement this satisfies is not "render an error" but "degrade
 * gracefully": if Quoting is down, Dashboard, Customers and Profile still work,
 * and the user is told so explicitly with links to them. A blank screen or a
 * bare "something went wrong" would strand someone who still has most of the
 * product available to them.
 */
export function ServiceUnavailable({
  serviceName,
  availableActions = [],
  reference,
  onRetry,
}: ServiceUnavailableProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-10 text-center"
    >
      <span
        className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--color-warning-50)]"
        aria-hidden
      >
        <CloudOff className="size-5 text-[var(--color-warning-600)]" />
      </span>

      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        {serviceName} is temporarily unavailable
      </h2>

      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        This part of the platform is not responding right now. The rest of Nexora is unaffected,
        and nothing you have already saved has been lost.
      </p>

      {onRetry ? (
        <div className="mt-5">
          <Button onClick={onRetry}>Retry</Button>
        </div>
      ) : null}

      {availableActions.length > 0 ? (
        <div className="mt-6 w-full border-t border-[var(--border-subtle)] pt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Still available
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {availableActions.map((action) => (
              <li key={action.href}>
                <a
                  href={action.href}
                  className="inline-flex rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  {action.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reference ? (
        <p className="mt-6 font-mono text-2xs text-[var(--text-tertiary)]">
          Reference {reference}
        </p>
      ) : null}
    </div>
  );
}
