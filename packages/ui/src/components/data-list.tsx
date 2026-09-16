import * as React from 'react';
import { cn } from '../lib/cn';

/** A definition-list key/value grid for detail pages (customer info, quote summary, etc.). */
export const DataList = React.forwardRef<HTMLDListElement, React.HTMLAttributes<HTMLDListElement>>(
  ({ className, ...props }, ref) => (
    <dl
      ref={ref}
      className={cn('grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm', className)}
      {...props}
    />
  ),
);
DataList.displayName = 'DataList';

export interface DataListItemProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** One key/value row. Must be a direct child of `DataList` (its grid places `dt`/`dd` in columns). */
export function DataListItem({ label, children, className }: DataListItemProps) {
  return (
    <>
      <dt className="text-[var(--text-tertiary)]">{label}</dt>
      <dd className={cn('text-[var(--text-primary)]', className)}>{children}</dd>
    </>
  );
}
