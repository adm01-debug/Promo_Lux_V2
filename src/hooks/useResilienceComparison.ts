import { useQuery } from "@tanstack/react-query";
import { buildComparison, type SnapshotFile, type ComparisonReport } from "@/lib/resilience/compareReport";

async function fetchJson(url: string): Promise<SnapshotFile> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar ${url}: HTTP ${res.status}`);
  return (await res.json()) as SnapshotFile;
}

export function useResilienceComparison() {
  return useQuery<ComparisonReport>({
    queryKey: ["resilience-comparison"],
    queryFn: async () => {
      const [baseline, current] = await Promise.all([
        fetchJson("/reports/baseline.json"),
        fetchJson("/reports/current.json"),
      ]);
      return buildComparison(baseline, current);
    },
    staleTime: 5 * 60 * 1000,
  });
}
