import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium leading-4',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
        brand: 'bg-[var(--accent-subtle)] text-[var(--accent-solid)]',
        success: 'bg-[var(--color-success-50)] text-[var(--color-success-700)]',
        warning: 'bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
        danger: 'bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
        info: 'bg-[var(--color-info-50)] text-[var(--color-info-700)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, tone, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />
));
Badge.displayName = 'Badge';
