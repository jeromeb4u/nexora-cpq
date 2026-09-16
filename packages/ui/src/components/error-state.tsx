import * as React from 'react';
import { ServerCrash } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  /** A support/error reference code, rendered in monospace for easy copy-paste into a ticket. */
  reference?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title, description, reference, onRetry, retryLabel = 'Retry', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn('flex flex-col items-center gap-1.5 px-6 py-12 text-center', className)}
      {...props}
    >
      <ServerCrash className="mb-1 size-8 text-[var(--color-danger-600)]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? <p className="max-w-sm text-xs text-[var(--text-tertiary)]">{description}</p> : null}
      {reference ? (
        <p className="font-mono text-2xs text-[var(--text-tertiary)]">Reference: {reference}</p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  ),
);
ErrorState.displayName = 'ErrorState';
