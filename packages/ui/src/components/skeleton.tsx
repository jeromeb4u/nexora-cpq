import * as React from 'react';
import { cn } from '../lib/cn';

/** A pulsing placeholder block for content that has not loaded yet. */
export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('animate-pulse rounded-sm bg-[var(--surface-sunken)] motion-reduce:animate-none', className)}
      {...props}
    />
  ),
);
Skeleton.displayName = 'Skeleton';

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder lines to render. Defaults to 3. */
  lines?: number;
}

/** A block of placeholder text lines, with the last line rendered shorter. */
export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 3, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  ),
);
SkeletonText.displayName = 'SkeletonText';

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder rows. Defaults to 5. */
  rows?: number;
  /** Number of placeholder columns. Defaults to 4. */
  cols?: number;
}

/** A placeholder table body, matching the row height of `Table`/`TableCell`. */
export const SkeletonTable = React.forwardRef<HTMLDivElement, SkeletonTableProps>(
  ({ className, rows = 5, cols = 4, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-label="Loading table data"
      className={cn(
        'w-full overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)]',
        className,
      )}
      {...props}
    >
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex items-center gap-4 px-3 py-2.5',
            rowIndex > 0 && 'border-t border-[var(--border-subtle)]',
          )}
        >
          {Array.from({ length: cols }, (__, colIndex) => (
            <Skeleton key={colIndex} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  ),
);
SkeletonTable.displayName = 'SkeletonTable';
