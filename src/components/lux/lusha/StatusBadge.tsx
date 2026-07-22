import { Badge } from "@/components/ui/badge";

// Badge de status do módulo Lusha. Extraído na R30 (split de LushaIntelligenceView).
// Fonte única de verdade para a semantização visual dos estados de enrichment/push.
export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    pending_enrichment: { label: "Pendente", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    enriching: { label: "Enriquecendo…", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    enriched: { label: "Enriquecido", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    pushing_bitrix: { label: "Enviando ao Bitrix…", className: "bg-primary/15 text-primary border-primary/30" },
    sent_to_bitrix: { label: "Enviado ao Bitrix", className: "bg-primary/15 text-primary border-primary/30" },
    bitrix_duplicate: { label: "Já existia no Bitrix", className: "bg-muted text-muted-foreground border-border/50" },
    not_found: { label: "Sem dados", className: "bg-muted text-muted-foreground border-border/50" },
    error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
    error_bitrix: { label: "Erro no Bitrix", className: "bg-destructive/15 text-destructive border-destructive/30" },
    error_auth: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
    error_rate_limit: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
    error_other: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const cfg = map[status ?? ""] ?? { label: status ?? "—", className: "bg-muted text-muted-foreground border-border/50" };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}
