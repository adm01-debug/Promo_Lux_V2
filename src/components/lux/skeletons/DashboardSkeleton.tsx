import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton, ChartSkeleton, TableRowSkeleton } from "./SkeletonPrimitives";

export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 bg-muted/50" />
      <Skeleton className="h-4 w-72 bg-muted/30" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <ChartSkeleton />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TableRowSkeleton rows={4} />
      <div className="glass rounded-lg p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-muted/30" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4 bg-muted/30" />
              <Skeleton className="h-2.5 w-1/2 bg-muted/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
