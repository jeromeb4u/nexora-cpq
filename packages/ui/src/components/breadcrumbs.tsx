import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

/**
 * Renders plain `<a>` elements rather than any framework's link component —
 * this package stays framework-agnostic. Consuming apps that need
 * client-side routing should wrap `Breadcrumbs` or fork the anchor markup.
 */
export function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex', className)} {...props}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3.5 text-[var(--text-tertiary)]" aria-hidden="true" />
              ) : null}
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-link)] hover:underline"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
