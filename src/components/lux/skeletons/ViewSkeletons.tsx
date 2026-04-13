import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton, ChartSkeleton, TableRowSkeleton } from "./SkeletonPrimitives";

export const CompaniesSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32 bg-muted/50" />
        <Skeleton className="h-4 w-56 bg-muted/30" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg bg-muted/30" />
        <Skeleton className="h-9 w-9 rounded-lg bg-muted/30" />
      </div>
    </div>
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-full bg-muted/20" />
      ))}
    </div>
    <TableRowSkeleton rows={8} />
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-36 bg-muted/20" />
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded bg-muted/20" />
        ))}
      </div>
    </div>
  </div>
);

export const AnalyticsSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="space-y-2">
      <Skeleton className="h-7 w-56 bg-muted/50" />
      <Skeleton className="h-4 w-80 bg-muted/30" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton height={220} />
      <ChartSkeleton height={220} />
      <div className="glass rounded-lg p-5">
        <Skeleton className="h-5 w-40 bg-muted/40 mb-4" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-[180px] w-[180px] rounded-full bg-muted/20" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2.5 w-2.5 rounded-full bg-muted/30" />
                <Skeleton className="h-3 w-20 bg-muted/20" />
                <Skeleton className="h-3 w-8 bg-muted/30 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass rounded-lg p-5 flex flex-col items-center justify-center">
        <Skeleton className="h-5 w-48 bg-muted/40 mb-6" />
        <Skeleton className="h-32 w-32 rounded-full bg-muted/20" />
        <Skeleton className="h-3 w-44 bg-muted/20 mt-4" />
      </div>
    </div>
  </div>
);

export const FormViewSkeleton = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 bg-muted/50" />
      <Skeleton className="h-4 w-72 bg-muted/30" />
    </div>
    <div className="glass rounded-lg p-6 space-y-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28 bg-muted/30" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted/20" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg bg-primary/20 mt-4" />
    </div>
  </div>
);

export const WorkflowsSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36 bg-muted/50" />
        <Skeleton className="h-4 w-64 bg-muted/30" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg bg-muted/30" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 bg-muted/40" />
            <Skeleton className="h-6 w-16 rounded-full bg-muted/20" />
          </div>
          <Skeleton className="h-3 w-full bg-muted/20" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-20 bg-muted/20 rounded" />
            <Skeleton className="h-8 w-20 bg-muted/20 rounded" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-muted/15" />
        </div>
      ))}
    </div>
  </div>
);

export const MapSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 bg-muted/50" />
      <Skeleton className="h-4 w-64 bg-muted/30" />
    </div>
    <Skeleton className="h-[500px] w-full rounded-lg bg-muted/15" />
  </div>
);

export const CampaignsSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36 bg-muted/50" />
        <Skeleton className="h-4 w-56 bg-muted/30" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg bg-muted/30" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <TableRowSkeleton rows={5} />
  </div>
);

export const AIAgentSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="space-y-2">
      <Skeleton className="h-7 w-36 bg-muted/50" />
      <Skeleton className="h-4 w-64 bg-muted/30" />
    </div>
    <div className="glass rounded-lg p-4 h-[400px] flex flex-col">
      <div className="flex-1 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
            <Skeleton className={`h-16 rounded-xl bg-muted/20 ${i % 2 ? "w-2/3" : "w-3/4"}`} />
          </div>
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-lg bg-muted/15 mt-4" />
    </div>
  </div>
);

export const IntentSignalsSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 bg-muted/50" />
        <Skeleton className="h-4 w-64 bg-muted/30" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg bg-muted/30" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass rounded-lg p-4 flex items-center gap-4" style={{ animationDelay: `${i * 0.08}s` }}>
          <Skeleton className="h-10 w-10 rounded-lg bg-muted/30" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32 bg-muted/40" />
              <Skeleton className="h-5 w-20 rounded-full bg-muted/20" />
              <Skeleton className="h-5 w-16 rounded-full bg-muted/20" />
            </div>
            <Skeleton className="h-3 w-3/4 bg-muted/20" />
          </div>
          <Skeleton className="h-3 w-20 bg-muted/15" />
        </div>
      ))}
    </div>
  </div>
);

export const StakeholdersSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 bg-muted/50" />
        <Skeleton className="h-4 w-72 bg-muted/30" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-40 rounded-lg bg-muted/20" />
        <Skeleton className="h-9 w-24 rounded-lg bg-muted/20" />
      </div>
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-10 flex-1 rounded-lg bg-muted/15" />
      <Skeleton className="h-10 w-32 rounded-lg bg-muted/15" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full bg-muted/30" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28 bg-muted/40" />
              <Skeleton className="h-3 w-20 bg-muted/20" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full bg-muted/20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full bg-muted/15" />
            <Skeleton className="h-5 w-20 rounded-full bg-muted/15" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded bg-muted/20" />
            <Skeleton className="h-3 w-32 bg-muted/15" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-muted/10" />
        </div>
      ))}
    </div>
  </div>
);

export const GmapsScraperSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 bg-muted/50" />
        <Skeleton className="h-4 w-72 bg-muted/30" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg bg-muted/30" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg bg-muted/30" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40 bg-muted/40" />
                <Skeleton className="h-3 w-24 bg-muted/20" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full bg-muted/20" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-20 bg-muted/15" />
            <Skeleton className="h-3 w-24 bg-muted/15" />
            <Skeleton className="h-3 w-16 bg-muted/15" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-muted/10" />
        </div>
      ))}
    </div>
  </div>
);

export const SettingsSkeleton = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <div className="space-y-2">
      <Skeleton className="h-7 w-40 bg-muted/50" />
      <Skeleton className="h-4 w-64 bg-muted/30" />
    </div>
    <div className="flex gap-1 border-b border-border/30 pb-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-t-lg bg-muted/20" />
      ))}
    </div>
    <div className="glass rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full bg-muted/30" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-muted/30" />
          <Skeleton className="h-3 w-48 bg-muted/20" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28 bg-muted/30" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted/20" />
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40 bg-muted/25" />
        <Skeleton className="h-6 w-11 rounded-full bg-muted/20" />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg bg-primary/20 mt-4" />
    </div>
  </div>
);
