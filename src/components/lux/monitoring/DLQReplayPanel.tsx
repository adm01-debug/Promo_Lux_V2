import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, RotateCcw, ShieldAlert, Camera, Globe } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/lux/EmptyState";
import { useActiveOrganization } from "@/contexts/active-org-context";
import {
  useDlqReplay,
  useDlqReplayList,
  useDlqMetrics,
  type DlqMotor,
} from "@/hooks/useDlqReplay";


interface MotorViewProps {
  motor: DlqMotor;
}

function MotorView({ motor }: MotorViewProps) {
  const { activeOrgId } = useActiveOrganization();
  const list = useDlqReplayList(motor, 50);
  const metrics = useDlqMetrics(motor);
  const replay = useDlqReplay(motor);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(50);
  const [reason, setReason] = useState("");

  const items = list.data ?? [];
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const m = metrics.data;


  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doReplay = async (mode: "selected" | "batch") => {
    if (!activeOrgId) {
      toast.error("Selecione uma organização ativa.");
      return;
    }
    const payload =
      mode === "selected"
        ? { organization_id: activeOrgId, dlq_ids: Array.from(selected), reason: reason || undefined }
        : { organization_id: activeOrgId, limit, reason: reason || undefined };
    try {
      const result = await replay.mutateAsync(payload);
      toast.success(
        `Replay concluído — reprocessados: ${result.replayed} · ignorados: ${result.skipped} · erros: ${result.errors}`,
      );
      setSelected(new Set());
    } catch (err) {
      toast.error(`Falha no replay: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const selectedCount = useMemo(
    () => items.filter((i) => selected.has(i.id)).length,
    [items, selected],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Total pendente" value={m?.total} tone="default" />
        <KpiCard
          label="Últimas 24h"
          value={m?.last24h}
          tone={(m?.last24h ?? 0) > 10 ? "warn" : "default"}
        />
        <KpiCard
          label="Última hora"
          value={m?.last1h}
          tone={(m?.last1h ?? 0) > 5 ? "critical" : "default"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">

        <div className="space-y-1.5">
          <Label htmlFor={`${motor}-limit`} className="text-xs">
            Reprocessar N mais antigos
          </Label>
          <Input
            id={`${motor}-limit`}
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`${motor}-reason`} className="text-xs">
            Motivo do replay (opcional)
          </Label>
          <Input
            id={`${motor}-reason`}
            placeholder="ex: recuperação após reset de rate-limit"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => doReplay("selected")}
          disabled={replay.isPending || selectedCount === 0}
          className="gap-1.5"
        >
          {replay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <RotateCcw className="h-3.5 w-3.5" />
          Reprocessar selecionados ({selectedCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => doReplay("batch")}
          disabled={replay.isPending}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reprocessar {limit} mais antigos
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {items.length} itens
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${list.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="DLQ vazia"
          description="Nenhum item pendente para replay neste motor."
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead className="text-center">Tentativas</TableHead>
                <TableHead>Último erro</TableHead>
                <TableHead>Falhou há</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-state={selected.has(item.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      aria-label={`Selecionar item ${item.id.slice(0, 8)}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {item.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={item.target}>
                    {item.target}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{item.attempts}</TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-[320px] truncate"
                    title={item.last_error ?? ""}
                  >
                    {item.last_error ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function DLQReplayPanel() {
  const { activeOrgId } = useActiveOrganization();

  if (!activeOrgId) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={ShieldAlert}
            title="Nenhuma organização ativa"
            description="Selecione uma organização para gerenciar o replay de DLQ."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RotateCcw className="h-4 w-4 text-primary" />
          Dead Letter Queue — Replay
        </CardTitle>
        <CardDescription>
          Reprocesse tarefas dos motores Instagram e Web que esgotaram tentativas. Cada replay é
          registrado em audit_logs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="instagram" className="space-y-4">
          <TabsList>
            <TabsTrigger value="instagram" className="gap-2">
              <Camera className="h-4 w-4" />
              Instagram
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2">
              <Globe className="h-4 w-4" />
              Web
            </TabsTrigger>
          </TabsList>
          <TabsContent value="instagram">
            <MotorView motor="instagram" />
          </TabsContent>
          <TabsContent value="web">
            <MotorView motor="web" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
