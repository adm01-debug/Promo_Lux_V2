import { Search, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutomationStage, StageStatus } from "@/hooks/useAutomationsMonitor";

const STAGE_LABELS: Record<AutomationStage, string> = {
  scraping: "Raspagem",
  enrichment: "Enrichment",
  localization: "Localização",
};

const STAGE_ICONS: Record<AutomationStage, typeof Search> = {
  scraping: Search,
  enrichment: Loader2,
  localization: Clock,
};

interface Props {
  stage: AutomationStage;
  status: StageStatus;
  className?: string;
}

/** Chip semântico que representa o estado de um estágio de automação. */
export function AutomationStageBadge({ stage, status, className }: Props) {
  const Icon = STAGE_ICONS[stage];
  const done = status === "done";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        done
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/50 bg-muted/40 text-muted-foreground",
        className,
      )}
      title={`${STAGE_LABELS[stage]}: ${done ? "concluído" : "pendente"}`}
    >
      <Icon className={cn("h-3 w-3", done && stage === "enrichment" && "animate-none")} aria-hidden="true" />
      {STAGE_LABELS[stage]}
    </span>
  );
}
