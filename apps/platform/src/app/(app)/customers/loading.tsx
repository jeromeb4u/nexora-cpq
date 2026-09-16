import { Skeleton, SkeletonTable } from '@nexora/ui';

/** Mirrors the customer list's header + filter bar + table layout while it loads. */
export default function CustomersLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-full sm:w-48" />
          <Skeleton className="h-8 w-full sm:w-48" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <SkeletonTable rows={8} cols={7} />
    </div>
  );
}
