import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/cn';

export const alertVariants = cva('flex gap-2.5 rounded-md border px-3 py-2.5 text-sm', {
  variants: {
    variant: {
      info: 'border-[var(--color-info-200)] bg-[var(--color-info-50)] text-[var(--color-info-700)]',
      success: 'border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]',
      warning: 'border-[var(--color-warning-200)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
      danger: 'border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

const ALERT_ICONS: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, children, ...props }, ref) => {
    const resolvedVariant: AlertVariant = variant ?? 'info';
    const Icon = ALERT_ICONS[resolvedVariant];
    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant: resolvedVariant }), className)} {...props}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className="text-[13px] leading-5">{children}</div> : null}
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';
