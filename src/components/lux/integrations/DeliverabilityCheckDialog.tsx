import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface CheckResult {
  found: boolean;
  record?: string;
  issues?: string[];
  policy?: string;
  selector?: string;
  pct?: number;
  records?: string[];
}

interface DeliverabilityResult {
  domain: string;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  checks: {
    spf: CheckResult;
    dkim: CheckResult;
    dmarc: CheckResult;
    mx: CheckResult;
  };
  recommendations: string[];
  checked_at: string;
}

const gradeTone: Record<DeliverabilityResult["grade"], string> = {
  "A+": "text-success border-success/40",
  A: "text-success border-success/40",
  B: "text-primary border-primary/40",
  C: "text-warning border-warning/40",
  D: "text-warning border-warning/40",
  F: "text-destructive border-destructive/40",
};

const CHECK_LABELS: { key: keyof DeliverabilityResult["checks"]; label: string }[] = [
  { key: "spf", label: "SPF" },
  { key: "dkim", label: "DKIM" },
  { key: "dmarc", label: "DMARC" },
  { key: "mx", label: "MX" },
];

/** Extrai o domínio do endereço da conta para alimentar o checker. */
function accountDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : "";
}

export function DeliverabilityCheckDialog({
  email,
  open,
  onOpenChange,
}: {
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const domain = email ? accountDomain(email) : "";

  const check = useMutation({
    mutationFn: async (target: string) => {
      const { data, error } = await supabase.functions.invoke("deliverability-check", {
        body: { domain: target },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as DeliverabilityResult;
    },
  });

  const result = check.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) check.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Entregabilidade do domínio
          </DialogTitle>
          <DialogDescription>
            Checa SPF, DKIM, DMARC e MX via DNS para o domínio de <span className="font-medium text-foreground">{email}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Domínio verificado</p>
              <p className="font-mono text-sm truncate">{domain || "—"}</p>
            </div>
            <Button
              size="sm"
              disabled={!domain || check.isPending}
              onClick={() => check.mutate(domain)}
            >
              {check.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verificando...
                </>
              ) : (
                "Verificar agora"
              )}
            </Button>
          </div>

          {check.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Falha na verificação</AlertTitle>
              <AlertDescription>{(check.error as Error).message}</AlertDescription>
            </Alert>
          )}

          {result && (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-sm px-3 py-1 ${gradeTone[result.grade]}`}>
                  {result.grade}
                </Badge>
                <div className="text-sm">
                  <span className="font-medium">{result.score}/100</span>
                  <span className="text-muted-foreground"> · verificado {new Date(result.checked_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CHECK_LABELS.map(({ key, label }) => {
                  const c = result.checks[key];
                  return (
                    <div key={key} className="rounded-lg border border-border/60 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{label}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${c.found ? "text-success border-success/40" : "text-destructive border-destructive/40"}`}
                        >
                          {c.found ? "OK" : "Ausente"}
                        </Badge>
                      </div>
                      {c.policy && <p className="text-[11px] text-muted-foreground mt-1">política: {c.policy}{c.pct != null ? ` (${c.pct}% das mensagens)` : ""}</p>}
                      {c.selector && <p className="text-[11px] text-muted-foreground mt-1">seletor: {c.selector}</p>}
                      {!!c.records?.length && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate" title={c.records.join(", ")}>
                          {c.records.length} registro{c.records.length > 1 ? "s" : ""} MX
                        </p>
                      )}
                      {!!c.issues?.length && (
                        <ul className="mt-1 space-y-0.5">
                          {c.issues.map((i) => (
                            <li key={i} className="text-[11px] text-warning">· {i}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {!!result.recommendations.length && (
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <p className="text-xs font-medium mb-1">Recomendações</p>
                  <ul className="space-y-1">
                    {result.recommendations.map((r) => (
                      <li key={r} className="text-[11px] text-muted-foreground">· {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}