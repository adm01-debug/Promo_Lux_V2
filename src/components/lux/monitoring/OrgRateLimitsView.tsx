import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Gauge, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrgRateLimit, useUpsertOrgRateLimit } from "@/hooks/useOrgRateLimit";

export const OrgRateLimitsView = () => {
  const { data, isLoading } = useOrgRateLimit();
  const save = useUpsertOrgRateLimit();
  const [concurrent, setConcurrent] = useState(5);
  const [perHour, setPerHour] = useState(100);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data) {
      setConcurrent(data.max_concurrent);
      setPerHour(data.max_per_hour);
      setNotes(data.notes ?? "");
    }
  }, [data]);

  const validate = (): string | null => {
    if (concurrent < 1 || concurrent > 100) return "Simultaneidade deve estar entre 1 e 100";
    if (perHour < 1 || perHour > 10000) return "Jobs por hora deve estar entre 1 e 10.000";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    try {
      await save.mutateAsync({ max_concurrent: concurrent, max_per_hour: perHour, notes: notes || null });
      toast.success("Limites atualizados");
    } catch (e) {
      toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Rate Limits — Motor de Raspagem</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Controla quantos jobs de raspagem podem executar simultaneamente e por hora nesta organização.
        Apenas admins podem editar. O worker respeita esses limites antes de reservar novas tarefas.
      </p>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="concurrent">Jobs simultâneos (máx)</Label>
            <Input
              id="concurrent"
              type="number"
              min={1}
              max={100}
              value={concurrent}
              onChange={(e) => setConcurrent(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">Entre 1 e 100. Recomendado: 3–10.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perhour">Jobs por hora (máx)</Label>
            <Input
              id="perhour"
              type="number"
              min={1}
              max={10000}
              value={perHour}
              onChange={(e) => setPerHour(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">Entre 1 e 10.000. Padrão: 100.</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: aumentar antes da campanha X"
              rows={2}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={onSave} disabled={save.isPending} className="gap-1.5">
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
