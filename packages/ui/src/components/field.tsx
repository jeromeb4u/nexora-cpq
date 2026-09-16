import * as React from 'react';
import { cn } from '../lib/cn';
import { Label } from './label';

export interface FieldProps {
  /** Visible label text. */
  label: string;
  /** Marks the field as required and shows the marker on the label. */
  required?: boolean;
  /** Helper text shown below the control when there is no error. */
  description?: React.ReactNode;
  /** Validation error. When present it replaces the description and marks the control invalid. */
  error?: React.ReactNode;
  /**
   * The form control. It must be a single element that forwards standard DOM
   * props (`id`, `aria-invalid`, `aria-describedby`) to its underlying input —
   * every control exported by this package does.
   */
  children: React.ReactElement<{
    id?: string;
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-describedby'?: string;
  }>;
  className?: string;
  /** Use a specific id instead of an auto-generated one (useful for tests). */
  id?: string;
}

/**
 * Composes a label, a form control, optional helper text and a validation
 * error, wiring `htmlFor`/`id`/`aria-describedby`/`aria-invalid` correctly so
 * every field in the app is accessible by construction.
 */
export function Field({ label, required = false, description, error, children, className, id }: FieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id: controlId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId} required={required}>
        {label}
      </Label>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-danger-600)]">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="text-xs text-[var(--text-tertiary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
