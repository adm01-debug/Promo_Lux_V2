import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Snapshot = {
  queue_kind: "scrape" | "web" | "instagram";
  captured_at: string;
  p95_seconds: number | null;
  breach_rate: number | null;
};

const COLORS: Record<Snapshot["queue_kind"], string> = {
  scrape: "hsl(var(--primary))",
  web: "hsl(var(--chart-2, 200 80% 55%))",
  instagram: "hsl(var(--chart-3, 320 70% 60%))",
};

const LABELS: Record<Snapshot["queue_kind"], string> = {
  scrape: "Scrape",
  web: "Web",
  instagram: "Instagram",
};

export function SlaTrendChart() {
  const { data } = useQuery({
    queryKey: ["sla-snapshots-trend"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sla_snapshots")
        .select("queue_kind, captured_at, p95_seconds, breach_rate")
        .gte("captured_at", since)
        .order("captured_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Snapshot[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = data ?? [];
  // group by day
  const buckets = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const day = new Date(r.captured_at).toISOString().slice(0, 10);
    const bucket = buckets.get(day) ?? { day };
    bucket[`${r.queue_kind}_p95`] = r.p95_seconds ?? 0;
    bucket[`${r.queue_kind}_breach`] = Number(((r.breach_rate ?? 0) * 100).toFixed(2));
    buckets.set(day, bucket);
  }
  const chartData = Array.from(buckets.values());

  return (
    <Card className="glass border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Tendência SLA (14 dias)
        </CardTitle>
        <CardDescription>
          p95 real e taxa de breach por fila, capturados diariamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem snapshots ainda — o primeiro é gerado às 03:00 UTC.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: "p95 (s)", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: "breach %", angle: 90, position: "insideRight", fontSize: 11 }}
                />
                <Tooltip />
                <Legend />
                {(["scrape", "web", "instagram"] as const).map((q) => (
                  <Line
                    key={`${q}-p95`}
                    yAxisId="left"
                    type="monotone"
                    dataKey={`${q}_p95`}
                    name={`${LABELS[q]} p95`}
                    stroke={COLORS[q]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                {(["scrape", "web", "instagram"] as const).map((q) => (
                  <Line
                    key={`${q}-breach`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`${q}_breach`}
                    name={`${LABELS[q]} breach%`}
                    stroke={COLORS[q]}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
