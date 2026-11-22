import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifyResult {
  email: string;
  valid: boolean;
  score: number;
  issues: string[];
  checks: {
    format: boolean;
    domain_exists: boolean;
    has_mx: boolean;
    not_disposable: boolean;
    not_role_account: boolean;
  };
  domain_info?: {
    mx_records: string[];
    has_a_record: boolean;
  };
}

const CHECK_LABELS: { key: keyof VerifyResult["checks"]; label: string }[] = [
  { key: "format", label: "Formato válido" },
  { key: "domain_exists", label: "Domínio existe" },
  { key: "has_mx", label: "Aceita e-mail (MX)" },
  { key: "not_disposable", label: "Não é descartável" },
  { key: "not_role_account", label: "Não é conta de função" },
];

function tone(r: VerifyResult) {
  if (r.valid && r.score >= 85) return { cls: "text-success border-success/40", Icon: ShieldCheck, label: "Verificado" };
  if (r.valid) return { cls: "text-primary border-primary/40", Icon: ShieldCheck, label: "Entregável" };
  if (r.score >= 40) return { cls: "text-warning border-warning/40", Icon: ShieldAlert, label: "Arriscado" };
  return { cls: "text-destructive border-destructive/40", Icon: ShieldX, label: "Não entregável" };
}

/**
 * Verifica entregabilidade de um e-mail individual via `email-verify`
 * (formato, domínio, MX, descartável, conta de função) e mostra score.
 * Clicar no badge executa a checagem.
 */
export function EmailVerifyBadge({ email, className }: { email: string; className?: string }) {
  const verify = useMutation({
    mutationFn: async (target: string) => {
      const { data, error } = await supabase.functions.invoke("email-verify", {
        body: { email: target, check_mx: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as VerifyResult;
    },
  });

  const result = verify.data;
  const visual = result ? tone(result) : null;
  const Icon = visual?.Icon ?? ShieldCheck;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => !verify.isPending && verify.mutate(email)}
          className={cn("inline-flex items-center", className)}
          aria-label={`Verificar entregabilidade de ${email}`}
        >
          <Badge
            variant="outline"
            className={cn("text-[10px] gap-1 cursor-pointer", visual?.cls ?? "text-muted-foreground")}
          >
            {verify.isPending ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Icon className="h-2.5 w-2.5" />
            )}
            {verify.isPending ? "Checando..." : visualize(visual, result)}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {verify.isError ? (
          <p className="text-xs">Falha na verificação: {(verify.error as Error).message}</p>
        ) : result ? (
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {visual!.label} · {result.score}/100
            </p>
            <ul className="space-y-0.5">
              {CHECK_LABELS.map(({ key, label }) => (
                <li key={key} className={cn("text-[11px]", result.checks[key] ? "text-success" : "text-destructive")}>
                  {result.checks[key] ? "✓" : "✕"} {label}
                </li>
              ))}
            </ul>
            {!!result.issues.length && (
              <ul className="space-y-0.5 pt-1 border-t border-border/40">
                {result.issues.map((i) => (
                  <li key={i} className="text-[11px] text-warning">· {i}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-xs">Clique para checar SPF, MX, descartável e conta de função.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function visualize(visual: { label: string } | null, result: VerifyResult | undefined): string {
  if (!result) return "Verificar";
  return `${visual!.label} · ${result.score}`;
}