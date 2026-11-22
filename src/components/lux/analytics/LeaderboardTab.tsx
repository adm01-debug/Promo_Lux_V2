import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  METRICS,
  METRIC_LABEL,
  rankBy,
  useLeaderboard,
  type LeaderboardMetric,
} from "@/hooks/useLeaderboard";

const formatValue = (metric: LeaderboardMetric, v: number) => {
  if (metric === "won_value") {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  return v.toLocaleString("pt-BR");
};

const medal = (idx: number) => {
  if (idx === 0) return { Icon: Trophy, className: "text-amber-500" };
  if (idx === 1) return { Icon: Medal, className: "text-slate-400" };
  if (idx === 2) return { Icon: Award, className: "text-amber-700" };
  return null;
};

const initials = (name: string | null) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export const LeaderboardTab = () => {
  const [metric, setMetric] = useState<LeaderboardMetric>("won_value");
  const [months, setMonths] = useState(1);
  const { data, isLoading } = useLeaderboard(months);

  const ranked = useMemo(() => rankBy(data ?? [], metric), [data, metric]);
  const top = ranked[0];
  const total = useMemo(
    () => ranked.reduce((s, r) => s + Number(r[metric]), 0),
    [ranked, metric],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Ranking de performance
          </h3>
          <p className="text-xs text-muted-foreground">
            Compare a produção da equipe pela métrica que importa agora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Este mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={(v) => setMetric(v as LeaderboardMetric)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : ranked.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Sem dados de produção ainda</p>
            <p className="text-xs text-muted-foreground">
              O ranking aparece quando houver negócios ganhos ou atividades no período.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {top && Number(top[metric]) > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-4 flex items-center gap-3">
                <Trophy className="h-6 w-6 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {top.full_name ?? "Membro"} lidera em {METRIC_LABEL[metric].toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatValue(metric, Number(top[metric]))}
                    {total > 0 && ` · ${((Number(top[metric]) / total) * 100).toFixed(0)}% do total da equipe`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {ranked.map((row, idx) => {
              const m = medal(idx);
              return (
                <Card key={row.user_id} className={cn(idx === 0 && "border-amber-500/30")}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="w-7 shrink-0 text-center">
                      {m ? (
                        <m.Icon className={cn("h-5 w-5 mx-auto", m.className)} />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">{initials(row.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{row.full_name ?? "Membro"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {Number(row.won_deals)} ganhos · {Number(row.activities)} atividades
                      </p>
                    </div>
                    <Badge variant={idx === 0 ? "default" : "secondary"} className="shrink-0 tabular-nums">
                      {formatValue(metric, Number(row[metric]))}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};