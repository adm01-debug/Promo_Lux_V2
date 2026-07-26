import { useMemo } from "react";
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

export interface SlaHistoryPoint {
  queue_kind: string;
  new_sla_seconds: number;
  created_at: string;
}

const COLORS: Record<string, string> = {
  scrape: "hsl(var(--primary))",
  web: "hsl(var(--chart-2, 200 80% 55%))",
  instagram: "hsl(var(--chart-3, 320 70% 60%))",
};

const LABELS: Record<string, string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

interface SlaHistoryTrendChartProps {
  /** Registros do histórico (ordem indiferente — o gráfico reordena). */
  rows: SlaHistoryPoint[];
}

/**
 * Evolução do SLA padrão por fila ao longo do tempo.
 *
 * Usa linha em degrau (`stepAfter`) porque o SLA é um valor discreto que
 * permanece constante até a próxima alteração — interpolar linearmente
 * sugeriria uma transição gradual que nunca ocorreu.
 */
export function SlaHistoryTrendChart({ rows }: SlaHistoryTrendChartProps) {
  const { data, queues } = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const kinds = Array.from(new Set(sorted.map((r) => r.queue_kind)));

    // Carry-forward: mantém o último valor conhecido de cada fila em cada ponto,
    // evitando "buracos" na linha quando outra fila é alterada.
    const last: Record<string, number> = {};
    const points = sorted.map((r) => {
      last[r.queue_kind] = r.new_sla_seconds;
      return {
        ts: new Date(r.created_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        ...last,
      } as Record<string, string | number>;
    });

    return { data: points, queues: kinds };
  }, [rows]);

  if (data.length < 2) return null;

  return (
    <div className="mb-4 h-48 w-full" aria-label="Gráfico de evolução do SLA padrão">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="ts"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
            unit="s"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              color: "hsl(var(--popover-foreground))",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [`${value}s`, LABELS[name] ?? name]}
          />
          <Legend
            formatter={(value: string) => LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          {queues.map((q) => (
            <Line
              key={q}
              type="stepAfter"
              dataKey={q}
              stroke={COLORS[q] ?? "hsl(var(--muted-foreground))"}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
