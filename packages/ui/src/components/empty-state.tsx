import * as React from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A lucide icon element, e.g. `<Inbox />`. Sized and coloured automatically. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Typically a `Button`. */
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center gap-1.5 px-6 py-12 text-center', className)}
      {...props}
    >
      {icon ? (
        <div className="mb-1 text-[var(--text-tertiary)] [&_svg]:size-8" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? <p className="max-w-sm text-xs text-[var(--text-tertiary)]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';
