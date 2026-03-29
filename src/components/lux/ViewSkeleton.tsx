import { Skeleton } from "@/components/ui/skeleton";

export const ViewSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 bg-muted/50" />
        <Skeleton className="h-4 w-72 bg-muted/30" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 bg-muted/40" />
              <Skeleton className="h-8 w-8 rounded-md bg-muted/30" />
            </div>
            <Skeleton className="h-8 w-20 bg-muted/50" />
            <Skeleton className="h-3 w-32 bg-muted/20" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <Skeleton className="h-5 w-40 bg-muted/40" />
        </div>
        <div className="p-5">
          <Skeleton className="h-[220px] w-full bg-muted/20 rounded-md" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <Skeleton className="h-5 w-32 bg-muted/40" />
          <Skeleton className="h-8 w-24 bg-muted/30 rounded-md" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full bg-muted/30" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-muted/30" />
                <Skeleton className="h-3 w-1/2 bg-muted/20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton = () => (
  <div className="glass rounded-lg overflow-hidden">
    <div className="p-5 border-b border-border/50 flex items-center justify-between">
      <Skeleton className="h-5 w-32 bg-muted/40" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 bg-muted/30 rounded-md" />
        <Skeleton className="h-8 w-8 bg-muted/30 rounded-md" />
      </div>
    </div>
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-muted/20 rounded" />
      ))}
    </div>
  </div>
);
