import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { LATENCY_THRESHOLDS, type ApiLatencyTrendPoint } from "@/hooks/useApiLatency";

interface LatencySparklineProps extends Omit<React.SVGProps<SVGSVGElement>, "points"> {
  /** Série temporal de latência (ordenada por bucket ascendente). */
  points: ApiLatencyTrendPoint[];
  /** Largura do desenho em unidades de viewBox. */
  width?: number;
  /** Altura do desenho em unidades de viewBox. */
  height?: number;
}

/**
 * Mini-gráfico (sparkline) da tendência de latência p95 ao longo do tempo.
 * Puramente apresentacional: recebe a série já resolvida e a desenha como
 * uma linha suave com área preenchida, colorindo pela pior severidade vista
 * na janela. Sem dependências de biblioteca de gráficos.
 */
export function LatencySparkline({
  points,
  width = 240,
  height = 48,
  className,
  ...props
}: LatencySparklineProps) {
  const geometry = useMemo(() => {
    if (points.length === 0) return null;

    const values = points.map((p) => Number(p.p95_ms) || 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = points.length > 1 ? width / (points.length - 1) : width;
    const pad = 3;
    const usableH = height - pad * 2;

    const coords = values.map((v, i) => {
      const x = points.length > 1 ? i * stepX : width / 2;
      const y = pad + usableH - ((v - min) / range) * usableH;
      return { x, y };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(" ");
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(2)} ${height} L ${coords[0].x.toFixed(2)} ${height} Z`;

    const peak = Math.max(...values);
    const severity =
      peak >= LATENCY_THRESHOLDS.p95CriticalMs
        ? "critical"
        : peak >= LATENCY_THRESHOLDS.p95WarnMs
          ? "warning"
          : "ok";

    return { line, area, severity, last: coords[coords.length - 1] };
  }, [points, width, height]);

  if (!geometry) {
    return (
      <div
        className={cn("flex h-12 items-center justify-center text-[10px] text-muted-foreground", className)}
      >
        sem dados
      </div>
    );
  }

  const stroke =
    geometry.severity === "critical"
      ? "hsl(var(--destructive))"
      : geometry.severity === "warning"
        ? "hsl(38 92% 50%)"
        : "hsl(var(--primary))";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-12 w-full", className)}
      role="img"
      aria-label="Tendência de latência p95"
      {...props}
    >
      <path d={geometry.area} fill={stroke} fillOpacity={0.12} stroke="none" />
      <path
        d={geometry.line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={geometry.last.x} cy={geometry.last.y} r={2.5} fill={stroke} />
    </svg>
  );
}
