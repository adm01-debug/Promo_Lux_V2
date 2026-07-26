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
import { buildSlaChartData, type SlaHistoryPoint } from "./slaHistoryChartData";

export type { SlaHistoryPoint };

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

const SOURCE_LABELS: Record<string, string> = {
  manual: "manual",
  recommendation: "auto-ajuste",
  seed: "inicial",
};

interface SlaHistoryTrendChartProps {
  /** Registros do histórico (ordem indiferente — o gráfico reordena). */
  rows: SlaHistoryPoint[];
}

interface DotPayload {
  changed: string;
  source: string;
}

/**
 * Ponto customizado: ajustes automáticos aparecem como losango vazado,
 * ajustes manuais como círculo cheio. Só o ponto da fila efetivamente
 * alterada recebe destaque — os demais são valores de carry-forward.
 */
function SourceDot(props: {
  cx?: number;
  cy?: number;
  dataKey?: string;
  stroke?: string;
  payload?: DotPayload;
}) {
  const { cx, cy, dataKey, stroke, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isChanged = payload.changed === dataKey;
  if (!isChanged) return <circle cx={cx} cy={cy} r={1.5} fill={stroke} opacity={0.35} />;
  if (payload.source === "recommendation") {
    return (
      <rect
        x={cx - 4}
        y={cy - 4}
        width={8}
        height={8}
        transform={`rotate(45 ${cx} ${cy})`}
        fill="hsl(var(--background))"
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill={stroke} />;
}

/**
 * Evolução do SLA padrão por fila ao longo do tempo.
 *
 * Usa linha em degrau (`stepAfter`) porque o SLA é um valor discreto que
 * permanece constante até a próxima alteração — interpolar linearmente
 * sugeriria uma transição gradual que nunca ocorreu.
 */
export function SlaHistoryTrendChart({ rows }: SlaHistoryTrendChartProps) {
  const { data, queues } = useMemo(() => buildSlaChartData(rows), [rows]);

  if (data.length < 2) return null;

  return (
    <div className="mb-4 space-y-1" aria-label="Gráfico de evolução do SLA padrão">
      <div className="h-48 w-full">
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
              formatter={(value: number, name: string, item: { payload?: DotPayload }) => {
                const p = item?.payload;
                const suffix =
                  p && p.changed === name
                    ? ` (${SOURCE_LABELS[p.source] ?? p.source})`
                    : "";
                return [`${value}s${suffix}`, LABELS[name] ?? name];
              }}
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
                dot={<SourceDot />}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" aria-hidden />
          Manual
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rotate-45 border border-muted-foreground"
            aria-hidden
          />
          Auto-ajuste
        </span>
      </p>
    </div>
  );
}
