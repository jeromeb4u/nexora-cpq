import * as React from 'react';
import { cn } from '../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const invalid = ariaInvalid === true || ariaInvalid === 'true';
    return (
      <input
        ref={ref}
        aria-invalid={ariaInvalid}
        className={cn(
          'h-8 w-full rounded-sm border bg-[var(--surface-raised)] px-2.5 text-sm text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-tertiary)] disabled:opacity-70',
          invalid ? 'border-[var(--color-danger-600)]' : 'border-[var(--border-default)]',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
