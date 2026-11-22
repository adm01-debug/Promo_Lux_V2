import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ListChecks, Loader2, Send, AlertTriangle, CheckCircle2 } from "lucide-react";

type TargetType = "profile" | "posts" | "hashtag" | "comments";

const TARGET_LABELS: Record<TargetType, { label: string; placeholder: string }> = {
  profile: { label: "Perfil", placeholder: "@usuario ou nome do perfil" },
  posts: { label: "Posts", placeholder: "@usuario" },
  hashtag: { label: "Hashtag", placeholder: "marketing" },
  comments: { label: "Comentarios", placeholder: "URL do post" },
};

interface EnqueueResponse {
  queue_id?: string;
  trace_id?: string;
  deduplicated?: boolean;
  error?: string;
}

interface WorkerHealth {
  queue?: Record<string, number>;
}

function extractError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function InstagramEnqueuePanel() {
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<TargetType>("profile");
  const [targetValue, setTargetValue] = useState("");
  const [limit, setLimit] = useState("50");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const health = useQuery<WorkerHealth>({
    queryKey: ["instagram-worker-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-worker-health");
      if (error) throw error;
      return (data ?? {}) as WorkerHealth;
    },
    refetchInterval: 30_000,
    retry: false,
  });

  const enqueue = useMutation({
    mutationFn: async () => {
      const value = targetValue.trim();
      if (!value) throw new Error("Informe o alvo da coleta.");
      const parsedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
      const { data, error } = await supabase.functions.invoke<EnqueueResponse>("instagram-enqueue", {
        body: { target_type: targetType, target_value: value, params: { limit: parsedLimit } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setFeedback({
        kind: "ok",
        text: data?.deduplicated
          ? "Tarefa ja existia na fila (deduplicada). Nada novo foi enfileirado."
          : `Tarefa enfileirada. ID: ${data?.queue_id ?? "n/d"}`,
      });
      setTargetValue("");
      qc.invalidateQueries({ queryKey: ["instagram-worker-health"] });
    },
    onError: (err) => setFeedback({ kind: "err", text: extractError(err) }),
  });

  const queue = health.data?.queue ?? {};
  const queueEntries = Object.entries(queue).filter(([, v]) => Number(v) > 0);
  const dlqCount = Number(queue.dead ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Enfileirar coleta
        </CardTitle>
        <CardDescription>
          Envia uma tarefa para a fila do motor de Instagram. O worker consome automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ig-target-type" className="text-xs">Tipo de alvo</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
              <SelectTrigger id="ig-target-type" aria-label="Tipo de alvo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TARGET_LABELS) as TargetType[]).map((k) => (
                  <SelectItem key={k} value={k}>{TARGET_LABELS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig-target-value" className="text-xs">Alvo</Label>
            <Input
              id="ig-target-value"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={TARGET_LABELS[targetType].placeholder}
              aria-label="Alvo da coleta"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ig-limit" className="text-xs">Limite de itens</Label>
            <Input
              id="ig-limit"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-28"
              aria-label="Limite de itens"
            />
          </div>
          <Button
            className="gap-2"
            onClick={() => enqueue.mutate()}
            disabled={enqueue.isPending || !targetValue.trim()}
          >
            {enqueue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enfileirar
          </Button>
        </div>

        {feedback && (
          <Alert variant={feedback.kind === "ok" ? "default" : "destructive"}>
            {feedback.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{feedback.kind === "ok" ? "Enfileirado" : "Falha ao enfileirar"}</AlertTitle>
            <AlertDescription>{feedback.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Estado da fila</p>
          <div className="flex flex-wrap gap-2">
            {queueEntries.length === 0 ? (
              <span className="text-xs text-muted-foreground">Fila vazia.</span>
            ) : (
              queueEntries.map(([status, count]) => (
                <Badge key={status} variant={status === "dead" ? "destructive" : "secondary"}>
                  {status}: {count}
                </Badge>
              ))
            )}
          </div>
          {dlqCount > 0 && (
            <p className="text-xs text-destructive">
              {dlqCount} tarefa(s) na dead-letter - verifique a aba DLQ.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
