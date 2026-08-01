import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDelta, formatPct, type SourceDelta, type SourceTotals } from "@/lib/sourceQualityReport";

export interface SourceComparisonSummaryProps {
  lusha: SourceTotals;
  apollo: SourceTotals;
  delta: SourceDelta;
}

interface MetricConfig {
  key: keyof SourceDelta;
  label: string;
  /** Para supressão, menor é melhor. */
  lowerIsBetter?: boolean;
}

const METRICS: MetricConfig[] = [
  { key: "email_rate", label: "E-mail confirmado" },
  { key: "br_rate", label: "Cobertura Brasil" },
  { key: "suppression_rate", label: "Taxa de supressão", lowerIsBetter: true },
];

const deltaTone = (value: number | null, lowerIsBetter?: boolean): string => {
  if (value === null || value === 0) return "text-muted-foreground";
  const positive = lowerIsBetter ? value < 0 : value > 0;
  return positive ? "text-emerald-500" : "text-destructive";
};

/** Cartões de topo com o consolidado por fonte e o ganho do fallback. */
export function SourceComparisonSummary({ lusha, apollo, delta }: SourceComparisonSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {METRICS.map((metric) => (
        <Card key={metric.key} className="bg-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Lusha</span>
              <span className="font-mono text-lg">{formatPct(lusha[metric.key])}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Apollo</span>
              <span className="font-mono text-lg text-primary">{formatPct(apollo[metric.key])}</span>
            </div>
            <div
              className={cn(
                "pt-1 text-right text-xs font-medium",
                deltaTone(delta[metric.key], metric.lowerIsBetter),
              )}
            >
              {formatDelta(delta[metric.key])}
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="col-span-full text-xs text-muted-foreground">
        Amostra: {lusha.total.toLocaleString("pt-BR")} contatos Lusha ·{" "}
        {apollo.total.toLocaleString("pt-BR")} contatos Apollo (fallback). A taxa de supressão é
        calculada sobre os contatos com e-mail obtido.
      </p>
    </div>
  );
}
