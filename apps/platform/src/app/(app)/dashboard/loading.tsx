import { SkeletonTable, SkeletonText } from '@nexora/ui';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonText lines={2} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4"
          >
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
