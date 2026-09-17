import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from './cn';

export interface MetricTileProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: 'neutral' | 'attention';
  readonly href?: string;
}

/**
 * A single dashboard figure.
 *
 * Deliberately plain: no sparkline, no percentage-change chip. A change
 * indicator implies a comparison period, and inventing one the data cannot
 * support would be exactly the fake-dashboard problem this project avoids.
 */
export function MetricTile({ label, value, hint, tone = 'neutral', href }: MetricTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </p>
        {href ? (
          <ArrowUpRight className="size-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
        ) : null}
      </div>
      <p
        className={cn(
          'tabular mt-2 text-2xl font-semibold tracking-tight',
          tone === 'attention' ? 'text-[var(--color-warning-600)]' : 'text-[var(--text-primary)]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-2xs mt-1 text-[var(--text-tertiary)]">{hint}</p> : null}
    </>
  );

  const className = cn(
    'block rounded-lg border bg-[var(--surface-raised)] p-4 transition-colors',
    tone === 'attention' ? 'border-[var(--color-warning-200)]' : 'border-[var(--border-subtle)]',
    href && 'hover:border-[var(--accent-border)] hover:bg-[var(--surface-selected)]',
  );

  // Cross-zone destinations must be a real navigation, not a client transition.
  if (href?.startsWith('/approvals') || href?.startsWith('/quotes')) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
