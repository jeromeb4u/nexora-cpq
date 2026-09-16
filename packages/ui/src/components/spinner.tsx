import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Screen-reader text announced while the spinner is visible. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SPINNER_SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'size-3.5',
  md: 'size-5',
  lg: 'size-7',
};

/** An accessible loading indicator: announces itself to screen readers and respects reduced-motion. */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, label = 'Loading…', size = 'md', ...props }, ref) => (
    <span ref={ref} role="status" className={cn('inline-flex items-center justify-center', className)} {...props}>
      <LoaderCircle
        className={cn(SPINNER_SIZE_CLASSES[size], 'animate-spin text-[var(--text-tertiary)] motion-reduce:animate-none')}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  ),
);
Spinner.displayName = 'Spinner';
