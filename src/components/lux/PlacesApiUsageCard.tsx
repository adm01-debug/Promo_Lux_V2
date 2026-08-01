import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlacesApiUsage, GOOGLE_MONTHLY_CREDIT_USD } from "@/hooks/usePlacesApiUsage";

const fmtUsd = (n: number) => `US$ ${n.toFixed(2)}`;

export const PlacesApiUsageCard = () => {
  const { data, isLoading } = usePlacesApiUsage();

  const cost = Number(data?.estimated_cost_usd ?? 0);
  const totalCalls =
    (data?.calls_essentials ?? 0) +
    (data?.calls_pro ?? 0) +
    (data?.calls_enterprise ?? 0);
  const pct = Math.min(100, (cost / GOOGLE_MONTHLY_CREDIT_USD) * 100);

  const severity =
    pct >= 90 ? "danger" : pct >= 60 ? "warn" : "ok";
  const severityColor =
    severity === "danger"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : severity === "warn"
        ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
        : "bg-success/15 text-success border-success/30";

  return (
    <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-foreground">Consumo Places API — mês atual</span>
              <Badge variant="outline" className={`text-[10px] ${severityColor}`}>
                {pct.toFixed(1)}% do crédito
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Info consumo">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Google concede US$ 200/mês de crédito automático. Chamadas Pro (com rating, telefone,
                    website, horários) custam ~US$ 40 por 1.000. O contador é incrementado a cada busca via
                    Places API (New).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> carregando...
                </span>
              ) : (
                <>
                  {fmtUsd(cost)} / {fmtUsd(GOOGLE_MONTHLY_CREDIT_USD)} · {totalCalls.toLocaleString("pt-BR")} chamadas
                </>
              )}
            </p>
          </div>
        </div>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>Essentials: <span className="text-foreground font-medium">{data?.calls_essentials ?? 0}</span></div>
        <div>Pro: <span className="text-foreground font-medium">{data?.calls_pro ?? 0}</span></div>
        <div>Enterprise: <span className="text-foreground font-medium">{data?.calls_enterprise ?? 0}</span></div>
      </div>
    </Card>
  );
};
