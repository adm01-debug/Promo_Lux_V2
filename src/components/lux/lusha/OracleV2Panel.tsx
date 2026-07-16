import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sparkles, ShieldAlert, CheckCircle2, Mail, Phone, Inbox, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SUGGESTED_DEPARTMENTS_PT } from "@/lib/lusha/departmentMap";
import { cn } from "@/lib/utils";
import {
  useOraclePreflight,
  useOracleSearchDecisors,
  useOracleEnrichContact,
  useOraclePushBitrix,
} from "@/hooks/useOracleV2";

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
    refetchInterval: 5000,
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
  const bitrixPronto = bitrixCompanyId.trim().length > 0 && /^\d+$/.test(bitrixUserId.trim());

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
    pushBitrix.mutate({
      contact_ids: enrichedIds.slice(0, 50),
      bitrix_company_id: bitrixCompanyId.trim(),
      bitrix_assigned_by_id: Number(bitrixUserId.trim()),
    });
  };

  const handlePushOne = (id: string) => {
    if (!bitrixPronto) return;
    pushBitrix.mutate({
      contact_ids: [id],
      bitrix_company_id: bitrixCompanyId.trim(),
      bitrix_assigned_by_id: Number(bitrixUserId.trim()),
    });
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
              <Button
                variant="default"
                onClick={handlePushAll}
                disabled={pushBitrix.isPending || !bitrixPronto}
                aria-busy={pushBitrix.isPending}
                title={bitrixPronto ? undefined : "Preencha o ID da empresa e do responsável no Bitrix"}
              >
                {pushBitrix.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Building2 className="h-4 w-4 mr-2" />
                )}
                Enviar {enrichedIds.length} ao Bitrix
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {sessionId && (
        <ResultsList
          contacts={contacts}
          isLoading={contactsQuery.isLoading}
          onEnrichOne={handleEnrichOne}
          enrichingContactIds={enrich.isPending ? new Set(enrich.variables?.contact_ids ?? []) : new Set()}
          onPushOne={handlePushOne}
          pushingContactIds={pushBitrix.isPending ? new Set(pushBitrix.variables?.contact_ids ?? []) : new Set()}
          bitrixPronto={bitrixPronto}
        />
      )}
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
}: {
  contacts: OracleContact[];
  isLoading: boolean;
  onEnrichOne: (id: string) => void;
  enrichingContactIds: Set<string>;
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
}: {
  contact: OracleContact;
  onEnrich: () => void;
  isEnriching: boolean;
}) {
  const status = contact.enrichment_status;
  const revealed = !!contact.email || !!contact.phone_formatted;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50">
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
    </div>
  );
}

function StatusBadge({ status, error }: { status: string | null; error: string | null }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending_enrichment: { label: "pendente", variant: "outline" },
    enriching: { label: "enriquecendo…", variant: "secondary" },
    enriched: { label: "enriquecido", variant: "default" },
    not_found: { label: "sem dado", variant: "secondary" },
    error_auth: { label: "cookie inválido", variant: "destructive" },
    error_rate_limit: { label: "rate limit", variant: "destructive" },
    error_other: { label: "erro", variant: "destructive" },
    same_session_dedup: { label: "duplicado", variant: "outline" },
  };
  const info = (status ? map[status] : null) ?? { label: status ?? "—", variant: "outline" as const };
  return (
    <Badge variant={info.variant} title={error ?? undefined} className="text-[10px]">
      {info.label}
    </Badge>
  );
}
