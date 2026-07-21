import { useEffect, useState } from "react";
import { Sparkles, Info, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FLAG_KEY = "use_places_api_new";

export const PlacesApiNewToggle = () => {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [flagId, setFlagId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("feature_flags")
      .select("id, is_enabled")
      .eq("flag_key", FLAG_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFlagId(data.id);
          setEnabled(!!data.is_enabled);
        } else {
          setEnabled(false);
        }
      });
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      if (flagId) {
        const { error } = await supabase
          .from("feature_flags")
          .update({ is_enabled: next })
          .eq("id", flagId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("feature_flags")
          .insert({ flag_key: FLAG_KEY, is_enabled: next })
          .select("id")
          .single();
        if (error) throw error;
        setFlagId(data.id);
      }
      setEnabled(next);
      qc.invalidateQueries({ queryKey: ["feature-flags"] });
      toast.success(next ? "Places API (New) ativada" : "Places API (New) desativada");
    } catch (err) {
      toast.error(`Falha: ${err instanceof Error ? err.message : "erro"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-foreground">Places API (New)</span>
              {enabled === null ? (
                <Badge variant="outline" className="text-[10px]">
                  <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> verificando
                </Badge>
              ) : enabled ? (
                <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">
                  ativa
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground border-border/40">
                  desativada
                </Badge>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Info Places API">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Quando ativa, o worker roteia buscas para a Places API (New) da Google via conector,
                    entregando 36+ campos por lugar (rating, reviews, horários, coordenadas, tipos de negócio).
                    Requer conexão Google Maps Platform. Custo por chamada pode variar por SKU.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Roteia novas buscas para o endpoint moderno com paridade de 36 campos.
            </p>
          </div>
        </div>
        <Switch
          checked={!!enabled}
          disabled={saving || enabled === null}
          onCheckedChange={handleToggle}
          aria-label="Alternar Places API (New)"
        />
      </div>
    </Card>
  );
};
