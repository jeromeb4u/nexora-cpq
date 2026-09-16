import { Card, CardContent, CardHeader, Skeleton, SkeletonTable, SkeletonText } from '@nexora/ui';

/** Mirrors the page's header + main-column/right-rail layout while the quote loads. */
export default function QuoteDetailLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 flex flex-col gap-5 xl:order-1">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <SkeletonTable rows={4} cols={7} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <SkeletonTable rows={3} cols={8} />
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
              <SkeletonText lines={5} />
            </CardContent>
          </Card>
        </div>

        <div className="order-1 xl:order-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-14 w-full" />
              <SkeletonText lines={4} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
