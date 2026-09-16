import { Card, CardHeader, Skeleton, SkeletonText } from '@nexora/ui';

/** Mirrors the activity feed's notifications + timeline layout while it loads. */
export default function ActivityLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3.5 w-56" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <div className="px-4 py-3">
          <SkeletonText lines={5} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <div className="px-4 py-3">
          <SkeletonText lines={6} />
        </div>
      </Card>
    </div>
  );
}
