import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * A native `<select>` styled to match the rest of the form controls. Native
 * select is used deliberately: it gets free mobile pickers, keyboard typeahead
 * and screen reader support that a custom listbox would have to reimplement.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, 'aria-invalid': ariaInvalid, children, ...props }, ref) => {
    const invalid = ariaInvalid === true || ariaInvalid === 'true';
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={ariaInvalid}
          className={cn(
            'h-8 w-full appearance-none rounded-sm border bg-[var(--surface-raised)] px-2.5 pr-8 text-sm text-[var(--text-primary)]',
            'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-tertiary)] disabled:opacity-70',
            invalid ? 'border-[var(--color-danger-600)]' : 'border-[var(--border-default)]',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
      </div>
    );
  },
);
Select.displayName = 'Select';
