import { Skeleton } from "@/components/ui/skeleton";
import type { View } from "@/hooks/useNavigationHistory";

/* ── Shared building blocks ───────────────────────────────── */

const StatCardSkeleton = () => (
  <div className="glass rounded-lg p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div className="skeleton-shimmer h-4 w-24 rounded" />
      <div className="skeleton-shimmer h-8 w-8 rounded-md" />
    </div>
    <div className="skeleton-shimmer h-8 w-20 rounded" />
    <div className="skeleton-shimmer h-3 w-32 rounded" />
  </div>
);

const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div className="glass rounded-lg overflow-hidden">
    <div className="p-5 border-b border-border/50">
      <Skeleton className="h-5 w-40 bg-muted/40" />
    </div>
    <div className="p-5">
      <Skeleton className={`w-full bg-muted/20 rounded-md`} style={{ height }} />
    </div>
  </div>
);

const TableRowSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="glass rounded-lg overflow-hidden">
    <div className="p-5 border-b border-border/50 flex items-center justify-between">
      <Skeleton className="h-5 w-32 bg-muted/40" />
      <Skeleton className="h-8 w-24 bg-muted/30 rounded-md" />
    </div>
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-muted/20 rounded" />
      ))}
    </div>
  </div>
);

/* ── View-specific skeletons ──────────────────────────────── */

const DashboardSkeleton = () => (
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

const CompaniesSkeleton = () => (
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
    {/* Filters bar */}
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

const AnalyticsSkeleton = () => (
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

const FormViewSkeleton = () => (
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

const WorkflowsSkeleton = () => (
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

const MapSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 bg-muted/50" />
      <Skeleton className="h-4 w-64 bg-muted/30" />
    </div>
    <Skeleton className="h-[500px] w-full rounded-lg bg-muted/15" />
  </div>
);

const CampaignsSkeleton = () => (
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

const AIAgentSkeleton = () => (
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

/* ── View → Skeleton mapping ──────────────────────────────── */

const SKELETON_MAP: Record<View, React.FC> = {
  dashboard: DashboardSkeleton,
  analytics: AnalyticsSkeleton,
  companies: CompaniesSkeleton,
  icp: FormViewSkeleton,
  settings: FormViewSkeleton,
  workflows: WorkflowsSkeleton,
  intent: CompaniesSkeleton,
  stakeholders: CompaniesSkeleton,
  campaigns: CampaignsSkeleton,
  "ai-agent": AIAgentSkeleton,
  gmaps: FormViewSkeleton,
  map: MapSkeleton,
};

/** Render a view-specific skeleton. Falls back to DashboardSkeleton. */
export function getViewSkeleton(view: View): React.FC {
  return SKELETON_MAP[view] ?? DashboardSkeleton;
}

/** Default generic skeleton (kept for backward compat) */
export const ViewSkeleton = DashboardSkeleton;

export const TableSkeleton = TableRowSkeleton;
