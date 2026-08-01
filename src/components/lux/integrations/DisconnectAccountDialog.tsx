import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Loader2,
  ShieldOff,
  Mail,
  Building2,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AccountLite {
  id: string;
  email: string;
  provider: "gmail" | "outlook";
  scope_type: "user" | "organization";
}

interface Props {
  account: AccountLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de desconexão: revoga tokens no provedor (best-effort), remove a
 * conta e dispara registro em audit_logs (via trigger + insert explícito).
 */
export function DisconnectAccountDialog({ account, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [revoke, setRevoke] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ revocation?: { attempted: boolean; success: boolean; error: string | null } } | null>(null);

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error("No account");
      const { data, error } = await supabase.functions.invoke("email-oauth-disconnect", {
        body: { account_id: account.id, revoke },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Falha ao desconectar");
      return data as { ok: true; revocation: { attempted: boolean; success: boolean; error: string | null } };
    },
    onSuccess: (d) => {
      setResult({ revocation: d.revocation });
      toast({
        title: "Conta desconectada",
        description: d.revocation.attempted
          ? d.revocation.success
            ? "Tokens revogados no provedor e auditoria registrada."
            : `Tokens não puderam ser revogados (${d.revocation.error ?? "erro"}). Remoção local concluída.`
          : "Remoção local concluída e auditoria registrada.",
      });
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const reset = () => {
    setRevoke(true);
    setConfirmText("");
    setResult(null);
    disconnect.reset();
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  if (!account) return null;
  const canConfirm = confirmText.trim().toLowerCase() === "desconectar" && !disconnect.isPending && !result;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-destructive" />
            Desconectar caixa de email
          </DialogTitle>
          <DialogDescription>
            Esta ação remove a integração e, opcionalmente, revoga os tokens no provedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="glass rounded-lg p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{account.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] capitalize">{account.provider}</Badge>
                {account.scope_type === "organization" ? (
                  <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                    <Building2 className="h-2.5 w-2.5" /> Compartilhada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <UserIcon className="h-2.5 w-2.5" /> Pessoal
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!result ? (
            <>
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-medium text-warning flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Consequências
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground list-disc list-inside">
                  <li>Replies de campanhas ativas deixarão de ser sincronizados.</li>
                  <li>Sequências em andamento podem falhar ao enviar pela próxima etapa.</li>
                  <li>A ação é registrada no audit log da organização.</li>
                  {account.scope_type === "organization" && (
                    <li>Outros membros da organização perderão acesso à caixa.</li>
                  )}
                </ul>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={revoke}
                  onCheckedChange={(v) => setRevoke(v === true)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-medium">
                    Revogar tokens no provedor {account.provider === "gmail" ? "(Google)" : "(Microsoft)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {account.provider === "gmail"
                      ? "Invalida access/refresh tokens via oauth2.googleapis.com/revoke."
                      : "Microsoft não suporta revoke por token — apenas remoção local."}
                  </p>
                </div>
              </label>

              <div>
                <label className="text-xs text-muted-foreground">
                  Digite <code className="font-mono text-foreground">desconectar</code> para confirmar
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="desconectar"
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoFocus
                />
              </div>
            </>
          ) : (
            <div className="rounded-md border border-success/30 bg-success/5 p-3 space-y-2">
              <p className="text-xs font-medium text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Conta removida e auditada
              </p>
              <div className="text-[11px] text-muted-foreground space-y-1">
                {result.revocation?.attempted ? (
                  result.revocation.success ? (
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      Tokens revogados no provedor.
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-warning">
                      <XCircle className="h-3 w-3" />
                      Revogação não confirmada: {result.revocation.error ?? "—"}
                    </p>
                  )
                ) : (
                  <p>Revogação remota não solicitada — apenas remoção local.</p>
                )}
                <p>Evento gravado em <code className="font-mono">audit_logs</code>.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!result ? (
            <>
              <Button variant="ghost" onClick={close} disabled={disconnect.isPending}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnect.mutate()}
                disabled={!canConfirm}
                className="gap-2"
              >
                {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                Desconectar
              </Button>
            </>
          ) : (
            <Button onClick={close}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}