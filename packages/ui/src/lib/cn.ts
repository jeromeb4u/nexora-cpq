import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names, resolving conflicting Tailwind utility classes so the
 * last one wins (e.g. `cn('px-2', condition && 'px-4')` -> `'px-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
