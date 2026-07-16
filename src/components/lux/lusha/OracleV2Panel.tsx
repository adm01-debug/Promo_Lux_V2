import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sparkles, ShieldAlert, CheckCircle2, Mail, Phone, Inbox, Building2, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SUGGESTED_DEPARTMENTS_PT } from "@/lib/lusha/departmentMap";
import { cn } from "@/lib/utils";
import {
  useOraclePreflight,
  useOracleSearchDecisors,
  useOracleEnrichContact,
  useOraclePushBitrix,
  type PushBitrixResultItem,
} from "@/hooks/useOracleV2";
import { computeBitrixReadiness } from "@/hooks/oracleV2Helpers";

import { useActiveOrganization } from "@/hooks/useOrganizations";

// ============================================================================
// Oracle v2 Panel — busca decisores + enriquece contatos
// Sem crédito Lusha pago. Cookies vêm do vault self-hosted.
// ============================================================================

interface OracleContact {
  id: string;
  full_name: string;
  job_title: string | null;
  department_en: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone_formatted: string | null;
  enrichment_status: string | null;
  last_error: string | null;
  bitrix_contact_id: string | null;
  bitrix_card_id: string | null;
}

export function OracleV2Panel() {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const preflight = useOraclePreflight();
  const search = useOracleSearchDecisors();
  const enrich = useOracleEnrichContact();
  const pushBitrix = useOraclePushBitrix();


  const [companyName, setCompanyName] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bitrixCompanyId, setBitrixCompanyId] = useState("");
  const [bitrixUserId, setBitrixUserId] = useState("");
  const [pushConfirm, setPushConfirm] = useState<
    | { kind: "all"; ids: string[] }
    | { kind: "one"; id: string; name: string }
    | null
  >(null);


  const toggleDept = (d: string) => {
    setSelectedDepts((s) => {
      const next = new Set(s);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  // Contatos da sessão atual, com realtime via refetch a cada 5s
  const contactsQuery = useQuery({
    queryKey: ["oracle", "contacts", sessionId],
    enabled: !!sessionId,
    refetchInterval: pushBitrix.isPending || enrich.isPending ? 1500 : 5000,
    queryFn: async (): Promise<OracleContact[]> => {
      const { data, error } = await supabase
        .from("lusha_contacts")
        .select("id, full_name, job_title, department_en, linkedin_url, email, phone_formatted, enrichment_status, last_error, bitrix_contact_id, bitrix_card_id")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OracleContact[];
    },
  });

  const contacts = contactsQuery.data ?? [];
  const pendingIds = useMemo(
    () => contacts.filter((c) => c.enrichment_status === "pending_enrichment").map((c) => c.id),
    [contacts],
  );
  const enrichedIds = useMemo(
    () => contacts.filter((c) => c.enrichment_status === "enriched" && !c.bitrix_contact_id).map((c) => c.id),
    [contacts],
  );
  const pushResult = pushBitrix.data ?? null;
  const pushResultByContact = useMemo(() => {
    const map = new Map<string, PushBitrixResultItem>();
    pushResult?.results.forEach((r) => map.set(r.contact_id, r));
    return map;
  }, [pushResult]);
  const { pronto: bitrixPronto, motivoBloqueio: bitrixMotivoBloqueio } = useMemo(
    () => computeBitrixReadiness(bitrixCompanyId, bitrixUserId),
    [bitrixCompanyId, bitrixUserId],
  );

  const handleSearch = () => {
    if (!activeOrg?.organization_id || !user) return;
    search.mutate(
      {
        company_name: companyName.trim(),
        departments: Array.from(selectedDepts),
        organization_id: activeOrg!.organization_id,
        bitrix_company_id: bitrixCompanyId.trim() || undefined,
        bitrix_user_id: bitrixUserId.trim() || undefined,
      },
      {
        onSuccess: (res) => setSessionId(res.session_id),
      },
    );
  };

  const handleEnrichAll = () => {
    if (pendingIds.length === 0) return;
    enrich.mutate({ contact_ids: pendingIds.slice(0, 50) });
  };

  const handleEnrichOne = (id: string) => {
    enrich.mutate({ contact_ids: [id] });
  };

  const handlePushAll = () => {
    if (enrichedIds.length === 0 || !bitrixPronto) return;
    setPushConfirm({ kind: "all", ids: enrichedIds.slice(0, 50) });
  };

  const handlePushOne = (id: string) => {
    if (!bitrixPronto) return;
    const contato = contacts.find((c) => c.id === id);
    setPushConfirm({ kind: "one", id, name: contato?.full_name ?? "este contato" });
  };

  const confirmPush = () => {
    if (!pushConfirm || !bitrixPronto) return;
    const ids = pushConfirm.kind === "all" ? pushConfirm.ids : [pushConfirm.id];
    pushBitrix.mutate({
      contact_ids: ids,
      bitrix_company_id: bitrixCompanyId.trim(),
      bitrix_assigned_by_id: Number(bitrixUserId.trim()),
    });
    setPushConfirm(null);
  };


  const canSearch =
    companyName.trim().length >= 2 && selectedDepts.size > 0 && !!activeOrg?.organization_id && !search.isPending;

  return (
    <div className="space-y-6">
      <VaultHealthBanner data={preflight.data} isLoading={preflight.isLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Oracle v2 — Busca de decisores (sem crédito Lusha)
          </CardTitle>
          <CardDescription>
            Selecione a empresa e os departamentos. A automação busca os decisores
            na Lusha (sem consumir crédito) e depois usa o LeadContact para revelar
            e-mail e telefone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oracle-company">Empresa</Label>
            <Input
              id="oracle-company"
              placeholder="Ex.: Ambev, Vale, Itaú..."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={search.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Departamentos</Label>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_DEPARTMENTS_PT.map((d) => {
                const active = selectedDepts.has(d);
                return (
                  <Badge
                    key={d}
                    variant={active ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                    onClick={() => toggleDept(d)}
                  >
                    {d}
                  </Badge>
                );
              })}
            </div>
          </div>


          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Destino no Bitrix24 (necessário para cadastrar os contatos)
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="bitrix-company" className="text-xs">ID da empresa</Label>
                <Input
                  id="bitrix-company"
                  inputMode="numeric"
                  placeholder="Ex.: 12345"
                  value={bitrixCompanyId}
                  onChange={(e) => setBitrixCompanyId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bitrix-user" className="text-xs">ID do responsável</Label>
                <Input
                  id="bitrix-user"
                  inputMode="numeric"
                  placeholder="Ex.: 14"
                  value={bitrixUserId}
                  onChange={(e) => setBitrixUserId(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSearch} disabled={!canSearch} aria-busy={search.isPending}>
              {search.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar decisores
            </Button>
            {pendingIds.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleEnrichAll}
                disabled={enrich.isPending}
                aria-busy={enrich.isPending}
              >
                {enrich.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Enriquecer {pendingIds.length} pendente(s)
              </Button>
            )}
            {enrichedIds.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={bitrixPronto ? -1 : 0}>
                    <Button
                      variant="default"
                      onClick={handlePushAll}
                      disabled={pushBitrix.isPending || !bitrixPronto}
                      aria-busy={pushBitrix.isPending}
                    >
                      {pushBitrix.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Building2 className="h-4 w-4 mr-2" />
                      )}
                      Enviar {enrichedIds.length} ao Bitrix
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {bitrixPronto
                    ? "Envia todos os contatos enriquecidos desta busca ao Bitrix (limite de 50 por lote)."
                    : `Envio bloqueado. ${bitrixMotivoBloqueio ?? ""}`}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      {pushBitrix.isPending && pushBitrix.variables?.contact_ids && (
        <PushProgressBar
          batchIds={pushBitrix.variables.contact_ids}
          contacts={contacts}
        />
      )}

      {pushResult && <PushResultSummary result={pushResult} contacts={contacts} />}

      {sessionId && (
        <ResultsList
          contacts={contacts}
          isLoading={contactsQuery.isLoading}
          onEnrichOne={handleEnrichOne}
          enrichingContactIds={enrich.isPending ? new Set(enrich.variables?.contact_ids ?? []) : new Set()}
          onPushOne={handlePushOne}
          pushingContactIds={pushBitrix.isPending ? new Set(pushBitrix.variables?.contact_ids ?? []) : new Set()}
          bitrixPronto={bitrixPronto}
          bitrixMotivoBloqueio={bitrixMotivoBloqueio}
          pushResultByContact={pushResultByContact}
        />
      )}

      <AlertDialog
        open={pushConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPushConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio ao Bitrix</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {pushConfirm?.kind === "all" ? (
                  <p>
                    Você vai enviar <strong>{pushConfirm.ids.length} contato(s)</strong> enriquecido(s)
                    ao Bitrix. Cada um vira um contato + card na esteira e não pode ser desfeito por aqui.
                  </p>
                ) : pushConfirm?.kind === "one" ? (
                  <p>
                    Você vai cadastrar <strong>{pushConfirm.name}</strong> no Bitrix e criar o card na esteira.
                  </p>
                ) : null}
                <ul className="text-xs text-muted-foreground list-disc pl-4">
                  <li>Empresa destino: <strong>{bitrixCompanyId.trim() || "—"}</strong></li>
                  <li>Responsável: <strong>{bitrixUserId.trim() || "—"}</strong></li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPush}>
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function VaultHealthBanner({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useOraclePreflight>["data"];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }
  if (!data) return null;
  if (data.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100"
      >
        <CheckCircle2 className="h-4 w-4" />
        Vault de cookies OK: Lusha, LeadContact e LinkedIn prontos.
      </div>
    );
  }
  const problems = data.services.filter((s) => !s.ready);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">Vault com problemas — automação bloqueada</p>
        <ul className="text-xs space-y-0.5">
          {problems.map((p) => (
            <li key={p.servico}>
              <strong>{p.servico}</strong>: {p.error ?? p.health_status ?? "unhealthy"}
              {p.expires_in_minutes !== null && ` (expira em ${p.expires_in_minutes} min)`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ResultsList({
  contacts,
  isLoading,
  onEnrichOne,
  enrichingContactIds,
  onPushOne,
  pushingContactIds,
  bitrixPronto,
  bitrixMotivoBloqueio,
  pushResultByContact,
}: {
  contacts: OracleContact[];
  isLoading: boolean;
  onEnrichOne: (id: string) => void;
  enrichingContactIds: Set<string>;
  onPushOne: (id: string) => void;
  pushingContactIds: Set<string>;
  bitrixPronto: boolean;
  bitrixMotivoBloqueio: string | null;
  pushResultByContact: Map<string, PushBitrixResultItem>;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-50" />
          <p className="font-medium text-foreground">Nenhum decisor nesta sessão</p>
          <p className="text-xs">
            Tente outra empresa ou adicione mais departamentos à busca.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decisores encontrados ({contacts.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            onEnrich={() => onEnrichOne(c.id)}
            isEnriching={enrichingContactIds.has(c.id) || c.enrichment_status === "enriching"}
            onPush={() => onPushOne(c.id)}
            isPushing={pushingContactIds.has(c.id)}
            bitrixPronto={bitrixPronto}
            bitrixMotivoBloqueio={bitrixMotivoBloqueio}
            pushResult={pushResultByContact.get(c.id) ?? null}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ContactRow({
  contact,
  onEnrich,
  isEnriching,
  onPush,
  isPushing,
  bitrixPronto,
  bitrixMotivoBloqueio,
  pushResult,
}: {
  contact: OracleContact;
  onEnrich: () => void;
  isEnriching: boolean;
  onPush: () => void;
  isPushing: boolean;
  bitrixPronto: boolean;
  bitrixMotivoBloqueio: string | null;
  pushResult: PushBitrixResultItem | null;
}) {
  const status = contact.enrichment_status;
  const revealed = !!contact.email || !!contact.phone_formatted;
  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2 hover:bg-muted/50">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-sm">{contact.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {contact.job_title ?? "—"}
            {contact.department_en && <> · {contact.department_en}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {contact.email && (
            <span className="flex items-center gap-1 text-foreground">
              <Mail className="h-3 w-3" /> {contact.email}
            </span>
          )}
          {contact.phone_formatted && (
            <span className="flex items-center gap-1 text-foreground">
              <Phone className="h-3 w-3" /> {contact.phone_formatted}
            </span>
          )}
        </div>
        <StatusBadge status={status} error={contact.last_error} />
        {!revealed && status !== "enriching" && (
          <Button size="sm" variant="outline" onClick={onEnrich} disabled={isEnriching}>
            {isEnriching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revelar"}
          </Button>
        )}
        {contact.enrichment_status === "enriched" && !contact.bitrix_contact_id && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={bitrixPronto ? -1 : 0}>
                <Button
                  size="sm"
                  onClick={onPush}
                  disabled={isPushing || !bitrixPronto}
                >
                  {isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviar ao Bitrix"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {bitrixPronto
                ? "Cadastra este contato no Bitrix e cria o card na esteira."
                : `Envio bloqueado. ${bitrixMotivoBloqueio ?? ""}`}
            </TooltipContent>
          </Tooltip>
        )}
        {contact.bitrix_card_id && (
          <a
            href={`https://promobrindes.bitrix24.com.br/crm/type/1328/details/${contact.bitrix_card_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> ver card
          </a>
        )}
      </div>
      {pushResult && <PushResultLine result={pushResult} />}
    </div>
  );
}

function PushResultLine({ result }: { result: PushBitrixResultItem }) {
  const map: Record<PushBitrixResultItem["status"], { label: string; className: string }> = {
    sent_to_bitrix: {
      label: `✓ Enviado ao Bitrix (contato #${result.bitrix_contact_id ?? "?"})`,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    bitrix_duplicate: {
      label: `↺ Já existia no Bitrix${result.matched_by ? ` — casou por ${result.matched_by}` : ""}`,
      className: "text-muted-foreground",
    },
    skipped: {
      label: `⤼ Pulado — ${result.error ?? "sem email nem telefone"}`,
      className: "text-amber-600 dark:text-amber-400",
    },
    error_bitrix: {
      label: `✗ Erro no Bitrix — ${result.error ?? "sem detalhe"}`,
      className: "text-destructive",
    },
  };
  const info = map[result.status];
  return <p className={cn("text-xs pl-1", info.className)}>{info.label}</p>;
}

function PushProgressBar({
  batchIds,
  contacts,
}: {
  batchIds: string[];
  contacts: OracleContact[];
}) {
  const total = batchIds.length;
  const batch = contacts.filter((c) => batchIds.includes(c.id));

  const sent = batch.filter((c) => c.enrichment_status === "sent_to_bitrix").length;
  const duplicates = batch.filter((c) => c.enrichment_status === "bitrix_duplicate").length;
  const skipped = batch.filter((c) => c.enrichment_status === "not_found").length;
  const errors = batch.filter((c) => c.enrichment_status === "error_bitrix").length;
  const processed = sent + duplicates + skipped + errors;
  const pending = Math.max(0, total - processed);
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const chips: Array<{ label: string; value: number; className: string }> = [
    { label: "Enviados", value: sent, className: "text-emerald-600 dark:text-emerald-400" },
    { label: "Duplicados", value: duplicates, className: "text-muted-foreground" },
    { label: "Sem dado", value: skipped, className: "text-amber-600 dark:text-amber-400" },
    { label: "Erros", value: errors, className: "text-destructive" },
    { label: "Restantes", value: pending, className: "text-primary" },
  ];

  return (
    <Card role="status" aria-live="polite" aria-busy="true">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Enviando ao Bitrix… {processed}/{total} ({pct}%)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {chips.map((c) => (
            <div key={c.label} className="rounded-md border px-2 py-1.5 text-center">
              <p className={cn("text-base font-semibold tabular-nums", c.className)}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PushResultSummary({
  result,
  contacts,
}: {
  result: { summary: { sent: number; duplicates: number; errors: number; sem_dado: number; skipped: number }; skipped: string[]; correlation_id: string };
  contacts: OracleContact[];
}) {
  const { sent, duplicates, errors, sem_dado, skipped } = result.summary;
  const skippedNames = result.skipped
    .map((id) => contacts.find((c) => c.id === id)?.full_name ?? id.slice(0, 8))
    .slice(0, 5);
  const items: Array<{ label: string; value: number; className: string }> = [
    { label: "Enviados", value: sent, className: "text-emerald-600 dark:text-emerald-400" },
    { label: "Duplicados", value: duplicates, className: "text-muted-foreground" },
    { label: "Sem email/telefone", value: sem_dado, className: "text-amber-600 dark:text-amber-400" },
    { label: "Erros", value: errors, className: "text-destructive" },
    { label: "Não elegíveis", value: skipped, className: "text-muted-foreground" },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Resultado do último envio ao Bitrix
        </CardTitle>
        <CardDescription className="text-[10px] font-mono break-all">
          correlation_id: {result.correlation_id}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {items.map((it) => (
            <div key={it.label} className="rounded-md border px-2 py-1.5 text-center">
              <p className={cn("text-lg font-semibold tabular-nums", it.className)}>{it.value}</p>
              <p className="text-[10px] text-muted-foreground">{it.label}</p>
            </div>
          ))}
        </div>
        {skippedNames.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Não elegíveis (precisam estar enriquecidos e sem Bitrix): {skippedNames.join(", ")}
            {result.skipped.length > skippedNames.length && ` (+${result.skipped.length - skippedNames.length})`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_INFO: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; explanation: string }
> = {
  pending_enrichment: {
    label: "pendente",
    variant: "outline",
    explanation: "Decisor encontrado na Lusha. Ainda não foi enviado ao LeadContact para revelar e-mail/telefone.",
  },
  enriching: {
    label: "enriquecendo…",
    variant: "secondary",
    explanation: "LeadContact está processando este contato agora. Aguarde alguns segundos.",
  },
  enriched: {
    label: "enriquecido",
    variant: "default",
    explanation: "E-mail e/ou telefone revelados. Pronto para enviar ao Bitrix (preencha os IDs de destino).",
  },
  not_found: {
    label: "sem dado",
    variant: "secondary",
    explanation:
      "Este contato foi PULADO porque o LeadContact não retornou nem e-mail nem telefone — sem esses dados o Bitrix rejeita o cadastro. Você pode tentar Revelar novamente mais tarde.",
  },
  error_auth: {
    label: "cookie inválido",
    variant: "destructive",
    explanation: "O cookie salvo no Vault expirou ou foi invalidado. Atualize o cookie e tente novamente.",
  },
  error_rate_limit: {
    label: "rate limit",
    variant: "destructive",
    explanation: "Muitas chamadas em pouco tempo. Aguarde alguns minutos antes de tentar de novo.",
  },
  error_other: {
    label: "erro",
    variant: "destructive",
    explanation: "Erro não classificado no enriquecimento. Consulte a mensagem detalhada.",
  },
  same_session_dedup: {
    label: "duplicado",
    variant: "outline",
    explanation: "Contato duplicado dentro desta mesma busca — ignorado para não gerar cadastro repetido.",
  },
  pushing_bitrix: {
    label: "enviando ao Bitrix…",
    variant: "secondary",
    explanation: "Envio para o Bitrix em andamento.",
  },
  sent_to_bitrix: {
    label: "no Bitrix",
    variant: "default",
    explanation: "Contato cadastrado no Bitrix com sucesso. Clique em 'ver card' para abrir.",
  },
  bitrix_duplicate: {
    label: "já existia no Bitrix",
    variant: "outline",
    explanation:
      "O Bitrix já tinha esse contato (mesmo e-mail, telefone ou LinkedIn). Vinculamos ao card existente em vez de duplicar.",
  },
  error_bitrix: {
    label: "erro no Bitrix",
    variant: "destructive",
    explanation: "O Bitrix rejeitou o cadastro. Veja a mensagem para o motivo exato.",
  },
};

function StatusBadge({ status, error }: { status: string | null; error: string | null }) {
  const info =
    (status ? STATUS_INFO[status] : null) ??
    { label: status ?? "—", variant: "outline" as const, explanation: "Status desconhecido." };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={info.variant} className="text-[10px] cursor-help">
          {info.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p className="font-medium mb-1">{info.label}</p>
        <p className="text-muted-foreground">{info.explanation}</p>
        {error && (
          <p className="mt-1 pt-1 border-t border-border/40">
            <span className="font-medium">Detalhe:</span> {error}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}


