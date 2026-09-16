import { Card, CardContent, CardHeader, Skeleton, SkeletonTable, SkeletonText } from '@nexora/ui';

/** Mirrors the customer detail page's header + stacked-cards layout while it loads. */
export default function CustomerDetailLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <SkeletonText lines={6} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <SkeletonText lines={4} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent>
          <SkeletonTable rows={3} cols={7} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent>
          <SkeletonText lines={5} />
        </CardContent>
      </Card>
    </div>
  );
}
