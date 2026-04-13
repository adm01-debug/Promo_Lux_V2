import { Skeleton } from "@/components/ui/skeleton";

export const StatCardSkeleton = () => (
  <div className="glass rounded-lg p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div className="skeleton-shimmer h-4 w-24 rounded" />
      <div className="skeleton-shimmer h-8 w-8 rounded-md" />
    </div>
    <div className="skeleton-shimmer h-8 w-20 rounded" />
    <div className="skeleton-shimmer h-3 w-32 rounded" />
  </div>
);

export const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div className="glass rounded-lg overflow-hidden">
    <div className="p-5 border-b border-border/50">
      <div className="skeleton-shimmer h-5 w-40 rounded" />
    </div>
    <div className="p-5">
      <div className="skeleton-shimmer w-full rounded-md" style={{ height }} />
    </div>
  </div>
);

export const TableRowSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="glass rounded-lg overflow-hidden">
    <div className="p-5 border-b border-border/50 flex items-center justify-between">
      <div className="skeleton-shimmer h-5 w-32 rounded" />
      <div className="skeleton-shimmer h-8 w-24 rounded-md" />
    </div>
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-12 w-full rounded" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  </div>
);

export function AccessibleSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando conteúdo">
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}
