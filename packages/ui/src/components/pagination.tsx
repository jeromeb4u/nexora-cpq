import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './button';

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Purely presentational pagination controls — the caller owns page state and data fetching. */
export function Pagination({ page, pageCount, onPageChange, className, ...props }: PaginationProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < pageCount;

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3', className)} {...props}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canGoPrevious}
        onClick={() => onPageChange(page - 1)}
        aria-label="Go to previous page"
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>
      <span className="tabular text-xs text-[var(--text-secondary)]" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canGoNext}
        onClick={() => onPageChange(page + 1)}
        aria-label="Go to next page"
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
