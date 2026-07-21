import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeatureFlag {
  id: string;
  is_enabled: boolean;
  updated_at: string;
}

export function ChaosEngineeringPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: flag } = useQuery({
    queryKey: ["chaos-scrape-flag"],
    queryFn: async () => {
      const { data } = await supabase
        .from("feature_flags")
        .select("id, is_enabled, updated_at")
        .eq("flag_key", "chaos_scrape_enabled")
        .is("organization_id", null)
        .maybeSingle();
      return data as FeatureFlag | null;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["chaos-recent-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_execution_logs")
        .select("id, status, message, created_at")
        .eq("failure_reason", "chaos_synthetic")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!flag?.id) throw new Error("Flag não inicializada");
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: enabled })
        .eq("id", flag.id);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["chaos-scrape-flag"] });
      toast({
        title: enabled ? "Chaos habilitado" : "Chaos desabilitado",
        description: enabled
          ? "1% das tarefas de scraping receberá falha sintética até você desligar."
          : "Injeção de falhas encerrada.",
        variant: enabled ? "destructive" : "default",
      });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-500" />
            Chaos Engineering — Fila de Scraping
          </CardTitle>
          <CardDescription>
            Quando habilitado, o worker injeta 1% de falhas sintéticas (rate limit, unavailable, timeout)
            em tarefas reais para validar que retry/backoff/DLQ estão funcionando em produção.
            Eventos são marcados com <code className="text-xs">metadata.chaos = true</code> e filtrados do SLA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div>
              <Label htmlFor="chaos-switch" className="text-sm font-medium cursor-pointer">
                chaos_scrape_enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                Status atual: {flag?.is_enabled ? "🔴 ATIVO" : "⚪ desligado"}
              </p>
            </div>
            <Switch
              id="chaos-switch"
              checked={!!flag?.is_enabled}
              onCheckedChange={(v) => toggle.mutate(v)}
              disabled={!flag || toggle.isPending}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Últimas injeções (auto-refresh 15s)
            </p>
            {(recent?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum evento chaos ainda.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-auto">
                {recent!.map((r: { id: string; status: string; message: string | null; created_at: string }) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs border-b border-border/30 py-1.5">
                    <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                    <span className="text-muted-foreground truncate flex-1">{r.message ?? "-"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
