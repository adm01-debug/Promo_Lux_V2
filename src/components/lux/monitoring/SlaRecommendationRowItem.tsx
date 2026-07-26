import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check } from "lucide-react";
import type { SlaRecommendationRow } from "./SlaRecommendationsCard";

const LABELS: Record<string, string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

const VERDICTS: Record<
  SlaRecommendationRow["verdict"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  too_tight: { label: "Apertado demais", variant: "destructive" },
  too_loose: { label: "Folgado demais", variant: "secondary" },
  ok: { label: "Adequado", variant: "default" },
  unset: { label: "Sem SLA definido", variant: "outline" },
  insufficient_data: { label: "Amostra insuficiente", variant: "outline" },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "manual",
  recommendation: "recomendação",
  seed: "inicial",
};

function fmtSeconds(value: number | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n >= 60 ? `${(n / 60).toFixed(1)}m` : `${n.toFixed(1)}s`;
}

/** Formata a procedência do padrão de enqueue de forma legível e tolerante a nulos. */
function fmtProvenance(source?: string | null, lastAppliedAt?: string | null): string | null {
  if (!source && !lastAppliedAt) return null;
  const label = source ? (SOURCE_LABELS[source] ?? source) : null;
  if (!lastAppliedAt) return label;
  const date = new Date(lastAppliedAt);
  if (Number.isNaN(date.getTime())) return label;
  const when = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return label ? `${label} · ${when}` : when;
}

export interface SlaRecommendationRowItemProps {
  row: SlaRecommendationRow;
  /** Padrão de enqueue atualmente persistido para esta fila (segundos). */
  currentDefault?: number | null;
  /** Origem do padrão persistido: manual, recommendation ou seed. */
  source?: string | null;
  /** Data ISO do último ajuste aplicado ao padrão. */
  lastAppliedAt?: string | null;
  /** Se o auto-ajuste diário está habilitado para esta fila. */
  autoTune?: boolean;
  onApply: (queueKind: SlaRecommendationRow["queue_kind"]) => void;
  onToggleAutoTune: (queueKind: SlaRecommendationRow["queue_kind"], enabled: boolean) => void;
  isApplying: boolean;
  isTogglingAutoTune?: boolean;
}

/** Linha da tabela de recomendações de SLA, com ação de aplicar o valor sugerido. */
export function SlaRecommendationRowItem({
  row,
  currentDefault,
  autoTune,
  onApply,
  onToggleAutoTune,
  isApplying,
  isTogglingAutoTune = false,
}: SlaRecommendationRowItemProps) {
  const verdict = VERDICTS[row.verdict] ?? VERDICTS.insufficient_data;
  const canApply =
    row.verdict !== "insufficient_data" && row.recommended_sla_seconds != null && !isApplying;
  const alreadyApplied =
    currentDefault != null &&
    row.recommended_sla_seconds != null &&
    Number(currentDefault) === Number(row.recommended_sla_seconds);
  const label = LABELS[row.queue_kind] ?? row.queue_kind;

  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">
        {label}
      </th>
      <td className="py-2 pr-3 text-muted-foreground">{row.sample_size}</td>
      <td className="py-2 pr-3">{fmtSeconds(row.p50_seconds)}</td>
      <td className="py-2 pr-3">{fmtSeconds(row.p95_seconds)}</td>
      <td className="py-2 pr-3">{fmtSeconds(row.current_sla_p50)}</td>
      <td className="py-2 pr-3 text-muted-foreground">{fmtSeconds(currentDefault)}</td>
      <td className="py-2 pr-3 font-mono text-foreground">
        {fmtSeconds(row.recommended_sla_seconds)}
      </td>
      <td className="py-2 pr-3">
        <Badge variant={verdict.variant}>{verdict.label}</Badge>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoTune ?? false}
            disabled={isTogglingAutoTune}
            onCheckedChange={(checked) => onToggleAutoTune(row.queue_kind, checked)}
            aria-label={`Auto-ajuste diário de SLA para ${label}`}
          />
          {isTogglingAutoTune ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <span className="text-xs text-muted-foreground">
              {autoTune ? "Ativo" : "Manual"}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 text-right">
        {alreadyApplied ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" aria-hidden /> Aplicado
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!canApply}
            onClick={() => onApply(row.queue_kind)}
            aria-label={`Aplicar SLA sugerido para ${label}`}
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              "Aplicar"
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}
