import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const invalid = ariaInvalid === true || ariaInvalid === 'true';
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        aria-invalid={ariaInvalid}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-xs border bg-[var(--surface-raised)]',
          'data-[state=checked]:bg-[var(--accent-solid)] data-[state=checked]:border-[var(--accent-solid)] data-[state=checked]:text-[var(--text-inverse)]',
          'data-[state=indeterminate]:bg-[var(--accent-solid)] data-[state=indeterminate]:border-[var(--accent-solid)] data-[state=indeterminate]:text-[var(--text-inverse)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-[var(--color-danger-600)]' : 'border-[var(--border-default)]',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          {props.checked === 'indeterminate' ? (
            <Minus className="size-3" aria-hidden="true" />
          ) : (
            <Check className="size-3" aria-hidden="true" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = 'Checkbox';
