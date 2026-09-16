import { SkeletonTable, SkeletonText } from '@nexora/ui';

/** Loading skeleton for the product catalogue, matching its layout. */
export default function ProductsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonText lines={2} className="max-w-xs" />
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
        <SkeletonText lines={1} className="max-w-sm" />
        <SkeletonText lines={1} className="max-w-md" />
      </div>

      <SkeletonTable rows={10} cols={10} />
    </div>
  );
}
