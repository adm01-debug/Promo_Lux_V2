import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users2, AlertTriangle, Loader2, ExternalLink, History, Building2, Globe, Mail, Phone, Sparkles, MapPin, Link2, Copy, CheckCircle2, XCircle, Clock, X, RotateCw, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Grupos de departamentos (PT-BR) ──
interface DeptGroup {
  label: string;
  items: string[];
}

const DEPT_GROUPS: DeptGroup[] = [
  { label: "Compras & Operações", items: ["Compras", "Suprimentos", "Logística", "Operações"] },
  { label: "Comercial & Marketing", items: ["Vendas", "Marketing", "Desenvolvimento de Negócios"] },
  { label: "Pessoas & Gestão", items: ["RH", "Diretoria", "Gerência"] },
  { label: "Finanças & TI", items: ["Financeiro", "TI", "Controladoria"] },
  { label: "Outros", items: ["Jurídico", "Engenharia", "Produto", "BI"] },
];

// ── Tipos ──
interface LushaContact {
  id: string;
  full_name: string;
  job_title: string | null;
  department_pt: string | null;
  linkedin_url: string | null;
  enrichment_status: string | null;
  created_at: string;
  session_id: string | null;
}

interface LushaSession {
  id: string;
  company_name: string;
  departments_requested: string[] | null;
  departments_mapped: string[] | null;
  total_found: number | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

interface SearchResponse {
  session_id: string;
  company_resolved: string;
  total_found: number;
  departments_searched: string[];
  departments_skipped: string[];
  contacts: LushaContact[];
}

interface DecisionMaker {
  id: string;
  fullName: string;
  jobTitle: string;
  departments: string[];
  seniority: string;
  company: string;
  location: string;
  linkedin: string;
  hasEmail: boolean;
  hasPhone: boolean;
  emailCredits: number;
  phoneCredits: number;
  linkedinFollowersCount?: number | null;
  linkedinConnectionsCount?: number | null;
  linkedinSkills?: string[];
  linkedinCertifications?: string[];
  linkedinCourses?: string[];
  linkedinAwards?: string[];
  xUrl?: string | null;
}


interface DMCompanyResult {
  domain: string;
  companyId?: string;
  total?: number;
  error?: string;
  decisionMakers: DecisionMaker[];
}

interface DMResponse {
  requestId: string;
  creditsCharged: number;
  totalDecisionMakers: number;
  results: DMCompanyResult[];
}

// ── Badge de status ──
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    enriched: { label: "Enriquecido", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    sent_to_bitrix: { label: "Enviado ao Bitrix", className: "bg-primary/15 text-primary border-primary/30" },
    error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const cfg = map[status ?? ""] ?? { label: status ?? "—", className: "bg-muted text-muted-foreground border-border/50" };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

export const LushaIntelligenceView = () => {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<SearchResponse | null>(null);
  const [cookieAlert, setCookieAlert] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [linkedinCompanyUrl, setLinkedinCompanyUrl] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [dmResults, setDmResults] = useState<DMCompanyResult[] | null>(null);
  const [dmRequestId, setDmRequestId] = useState<string | null>(null);
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());
  const [revealedData, setRevealedData] = useState<Record<string, {
    emails: { email: string; type: string | null }[];
    phones: { number: string; type: string | null }[];
    error?: string;
  }>>({});
  const [detailsModal, setDetailsModal] = useState<{
    type: "certifications" | "courses" | "awards";
    dm: DecisionMaker;
  } | null>(null);

  // ── Progresso da busca por domínio (fases visuais) ──
  type SearchPhase = "idle" | "queued" | "processing" | "done" | "failed";
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("idle");
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatusMsg, setSearchStatusMsg] = useState<string>("");
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [copiedLinkedin, setCopiedLinkedin] = useState(false);

  // ── Helpers de normalização e validação ──
  const EXAMPLE_DOMAIN = "natura.com.br";
  const EXAMPLE_LINKEDIN = "linkedin.com/company/natura";

  const normalizeDomain = useCallback((input: string): string => {
    let v = (input ?? "").trim().toLowerCase();
    if (!v) return "";
    // remove protocolo, barras finais, caminho e query
    v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    v = v.split("/")[0].split("?")[0].split("#")[0];
    return v;
  }, []);

  const validateDomain = useCallback((raw: string): { value: string; error: string | null } => {
    const value = normalizeDomain(raw);
    if (!value) return { value, error: "Informe o domínio do site da empresa." };
    if (/(^|\.)linkedin\.com$/i.test(value)) {
      return {
        value,
        error: "Este campo aceita apenas o domínio do site. Para o LinkedIn, use o campo abaixo.",
      };
    }
    if (/(^|\.)(facebook|instagram|twitter|x|tiktok|youtube)\.com$/i.test(value)) {
      return { value, error: "Redes sociais não são aceitas — informe o domínio do site oficial." };
    }
    // domínio válido: pelo menos um ponto e caracteres permitidos
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
      return { value, error: "Formato inválido. Use apenas o domínio (ex.: natura.com.br)." };
    }
    if (value.length > 253) return { value, error: "Domínio muito longo." };
    return { value, error: null };
  }, [normalizeDomain]);

  const normalizeLinkedinCompanyUrl = useCallback((input: string): string => {
    let v = (input ?? "").trim();
    if (!v) return "";
    v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    // remove query/hash/trailing slash
    v = v.split("?")[0].split("#")[0].replace(/\/+$/, "");
    return v.toLowerCase();
  }, []);

  const validateLinkedinCompanyUrl = useCallback((raw: string): { value: string; error: string | null } => {
    const value = normalizeLinkedinCompanyUrl(raw);
    if (!value) return { value, error: null }; // opcional
    if (!/^linkedin\.com\/(company|school|showcase)\/[a-z0-9\-_.%]+\/?$/i.test(value)) {
      return {
        value,
        error: "Use a URL da página da empresa no LinkedIn (ex.: linkedin.com/company/natura).",
      };
    }
    return { value, error: null };
  }, [normalizeLinkedinCompanyUrl]);

  const applyExample = useCallback(() => {
    setDomain(EXAMPLE_DOMAIN);
    setLinkedinCompanyUrl(EXAMPLE_LINKEDIN);
    setDomainError(null);
    setLinkedinError(null);
  }, []);


  // Histórico de sessões
  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["lusha-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lusha_search_sessions")
        .select("id, company_name, departments_requested, departments_mapped, total_found, status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as LushaSession[];
    },
  });

  // Contatos da sessão mais recente (ou da última busca)
  const activeSessionId = lastResult?.session_id ?? sessions[0]?.id ?? null;

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["lusha-contacts", activeSessionId],
    enabled: !!activeSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lusha_contacts")
        .select("id, full_name, job_title, department_pt, linkedin_url, enrichment_status, created_at, session_id")
        .eq("session_id", activeSessionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LushaContact[];
    },
  });

  // ── Countdown do rate limit (decrementa 1s a 1s) ──
  useEffect(() => {
    if (rateLimitCountdown == null || rateLimitCountdown <= 0) return;
    const id = setInterval(() => {
      setRateLimitCountdown((prev) => (prev == null ? null : prev <= 1 ? null : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimitCountdown]);

  const dmMutation = useMutation({
    mutationFn: async () => {
      const d = validateDomain(domain);
      const l = validateLinkedinCompanyUrl(linkedinCompanyUrl);
      setDomainError(d.error);
      setLinkedinError(l.error);
      if (d.error) throw new Error(d.error);
      if (l.error) throw new Error(l.error);
      if (d.value !== domain) setDomain(d.value);
      if (l.value !== linkedinCompanyUrl) setLinkedinCompanyUrl(l.value);

      // Fase 1: em fila
      setSearchPhase("queued");
      setSearchProgress(10);
      setSearchStatusMsg("Enviando requisição...");

      // Fase 2: processando (com progresso simulado enquanto aguarda a Lusha)
      const processingTimer = setTimeout(() => {
        setSearchPhase("processing");
        setSearchStatusMsg("Consultando Lusha Decision Makers V3...");
      }, 400);

      const progressTimer = setInterval(() => {
        setSearchProgress((p) => (p < 88 ? p + Math.max(1, Math.round((90 - p) / 12)) : p));
      }, 350);

      try {
        const { data, error } = await supabase.functions.invoke<DMResponse>("lusha-decision-makers", {
          body: {
            domains: [d.value],
            company_linkedin_url: l.value || null,
          },
        });
        if (error) {
          // supabase-js encapsula o body em error.context (Response). Extrai retry_after quando presente.
          let retryAfter: number | null = null;
          let friendly: string | null = null;
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.clone().json();
              if (body?.retry_after_seconds != null) retryAfter = Number(body.retry_after_seconds);
              if (body?.error?.code === "lusha_rate_limited") {
                friendly = body?.error?.message ?? null;
              } else if (body?.error?.message) {
                friendly = body.error.message;
              }
            } catch { /* ignora parse */ }
          }
          if (retryAfter != null || /rate|429/i.test(error.message ?? "")) {
            const wait = retryAfter ?? 60;
            const err = new Error(friendly ?? `Limite de requisições atingido. Aguarde ${wait}s antes de tentar novamente.`);
            (err as unknown as { rateLimit: number }).rateLimit = wait;
            throw err;
          }
          throw friendly ? new Error(friendly) : error;
        }
        return data as DMResponse;
      } finally {
        clearTimeout(processingTimer);
        clearInterval(progressTimer);
      }
    },
    onSuccess: (data) => {
      setDmResults(data.results ?? []);
      setDmRequestId(data.requestId ?? null);
      setRevealedData({});
      setRevealingIds(new Set());
      setSearchPhase("done");
      setSearchProgress(100);
      setSearchStatusMsg(`${data.totalDecisionMakers} decisor(es) localizado(s).`);
      toast({
        title: "Decisores encontrados",
        description: `${data.totalDecisionMakers} decisor(es) localizado(s) — 0 créditos consumidos.`,
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const wait = (err as { rateLimit?: number })?.rateLimit;
      setSearchPhase("failed");
      setSearchProgress(100);
      setSearchStatusMsg(msg);
      if (wait) {
        setRateLimitCountdown(wait);
        toast({
          title: "Limite de requisições da Lusha",
          description: `${msg} Você poderá tentar novamente em ${wait}s.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro na busca por domínio", description: msg, variant: "destructive" });
      }
    },
  });


  // ── Hidratação: carrega emails/telefones já persistidos em lusha_contacts ──
  useEffect(() => {
    if (!dmResults || dmResults.length === 0) return;
    const allDMs = dmResults.flatMap((r) => r.decisionMakers);
    const linkedinUrls = allDMs.map((dm) => dm.linkedin).filter(Boolean);
    if (linkedinUrls.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("lusha_contacts")
        .select("linkedin_url, email, phone_formatted, phone_raw, has_email, has_phone, enrichment_status, company_linkedin_url")
        .in("linkedin_url", linkedinUrls);
      if (cancelled || error || !data) return;

      const byUrl = new Map(data.map((row) => [row.linkedin_url, row]));
      const hydrated: Record<string, { emails: { email: string; type: string | null }[]; phones: { number: string; type: string | null }[]; error?: string }> = {};
      let companyLinkedinFromDB: string | null = null;
      for (const dm of allDMs) {
        const row = byUrl.get(dm.linkedin);
        if (!row) continue;
        if (!companyLinkedinFromDB && row.company_linkedin_url) {
          companyLinkedinFromDB = row.company_linkedin_url;
        }
        const emails = row.email ? [{ email: row.email, type: null }] : [];
        const phones = row.phone_formatted || row.phone_raw
          ? [{ number: row.phone_formatted ?? row.phone_raw!, type: null }]
          : [];
        if (emails.length > 0 || phones.length > 0) {
          hydrated[dm.id] = { emails, phones };
        }
      }
      if (Object.keys(hydrated).length > 0) {
        setRevealedData((prev) => ({ ...hydrated, ...prev }));
      }
      // Preenche o campo de LinkedIn da empresa se estiver vazio na UI
      if (companyLinkedinFromDB) {
        setLinkedinCompanyUrl((prev) => prev.trim() ? prev : companyLinkedinFromDB!);
      }
    })();
    return () => { cancelled = true; };
  }, [dmResults]);


  // ── Tradução de códigos de erro conhecidos do Lusha para PT-BR ──
  const translateRevealError = useCallback((raw: string | undefined): string => {
    if (!raw) return "Falha desconhecida ao revelar.";
    const code = raw.toLowerCase();
    if (code.includes("not_found") || code.includes("no_data")) return "Sem dados disponíveis para este decisor.";
    if (code.includes("credit")) return "Sem créditos Lusha suficientes para revelar.";
    if (code.includes("rate") || code.includes("429")) return "Limite de requisições atingido — tente novamente em instantes.";
    if (code.includes("unauthor") || code.includes("401") || code.includes("403")) return "Chave da API Lusha inválida ou sem permissão.";
    if (code.includes("timeout")) return "Tempo esgotado ao consultar o Lusha.";
    if (code.includes("network") || code.includes("fetch")) return "Falha de rede ao contatar o Lusha.";
    if (code.includes("invalid")) return "Requisição inválida (contactId ou requestId expirado).";
    return raw;
  }, []);

  // ── Persiste email/telefone revelado em lusha_contacts (por linkedin_url) ──
  const persistRevealed = useCallback(async (dm: DecisionMaker, entry: {
    emailAddresses?: { email: string; type: string | null }[];
    phoneNumbers?: { number: string; type: string | null }[];
  }) => {
    if (!dm.linkedin) return;
    const email = entry.emailAddresses?.[0]?.email ?? null;
    const phone = entry.phoneNumbers?.[0]?.number ?? null;
    if (!email && !phone) return;
    const update: Record<string, unknown> = {
      enrichment_status: "found",
      updated_at: new Date().toISOString(),
    };
    if (email) { update.email = email; update.email_source = "lusha_reveal"; update.has_email = true; }
    if (phone) {
      update.phone_formatted = phone;
      update.phone_raw = phone;
      update.phone_source = "lusha_reveal";
      update.has_phone = true;
    }
    if (entry.emailAddresses?.length) update.raw_leadcontact_email = entry.emailAddresses;
    if (entry.phoneNumbers?.length) update.raw_leadcontact_phone = entry.phoneNumbers;

    const { error } = await supabase
      .from("lusha_contacts")
      .update(update)
      .eq("linkedin_url", dm.linkedin);
    if (error) {
      console.warn("[lusha-reveal] falha ao persistir contato", error.message);
    }
  }, []);


  const canSearchDomain = useMemo(() => {
    if (dmMutation.isPending) return false;
    if (rateLimitCountdown != null && rateLimitCountdown > 0) return false;
    const d = validateDomain(domain);
    if (d.error) return false;
    const l = validateLinkedinCompanyUrl(linkedinCompanyUrl);
    if (l.error) return false;
    return true;
  }, [domain, linkedinCompanyUrl, dmMutation.isPending, rateLimitCountdown, validateDomain, validateLinkedinCompanyUrl]);

  async function handleReveal(dm: DecisionMaker) {
    if (!dmRequestId) {
      toast({
        title: "Sessão de busca não encontrada",
        description: "Refaça a busca por domínio antes de revelar dados.",
        variant: "destructive",
      });
      return;
    }
    if (revealingIds.has(dm.id) || revealedData[dm.id]) return;

    setRevealingIds((prev) => new Set(prev).add(dm.id));

    const MAX_ATTEMPTS = 3;
    const isRetryable = (raw?: string) => {
      if (!raw) return true;
      const c = raw.toLowerCase();
      return c.includes("timeout") || c.includes("network") || c.includes("fetch") ||
             c.includes("rate") || c.includes("429") || c.includes("503") ||
             c.includes("502") || c.includes("500") || c.includes("temporarily");
    };

    let attempt = 0;
    let lastError: string | undefined;
    try {
      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          const { data, error } = await supabase.functions.invoke<{
            requestId: string;
            creditsCharged: number | null;
            totalRevealed: number;
            totalRequested: number;
            revealed: Array<{
              contactId: string;
              error?: string;
              emailAddresses?: { email: string; type: string | null }[];
              phoneNumbers?: { number: string; type: string | null; doNotCall?: boolean | null }[];
            }>;
          }>("lusha-reveal", {
            body: {
              requestId: dmRequestId,
              contactIds: [dm.id],
              revealEmails: dm.hasEmail,
              revealPhones: dm.hasPhone,
            },
          });
          if (error) throw new Error(error.message || "network_error");
          const entry = data?.revealed?.find((r) => r.contactId === dm.id);
          if (!entry) throw new Error("no_data_returned");

          if (entry.error) {
            lastError = entry.error;
            if (isRetryable(entry.error) && attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
              continue;
            }
            setRevealedData((prev) => ({
              ...prev,
              [dm.id]: { emails: [], phones: [], error: translateRevealError(entry.error) },
            }));
            toast({
              title: `Falha ao revelar (${attempt}/${MAX_ATTEMPTS})`,
              description: `${dm.fullName}: ${translateRevealError(entry.error)}`,
              variant: "destructive",
            });
            return;
          }

          // sucesso
          setRevealedData((prev) => ({
            ...prev,
            [dm.id]: {
              emails: entry.emailAddresses ?? [],
              phones: entry.phoneNumbers ?? [],
            },
          }));
          await persistRevealed(dm, entry);
          toast({
            title: "Dados revelados",
            description: `${dm.fullName}${data?.creditsCharged != null ? ` — ${data.creditsCharged} crédito(s) consumido(s)` : ""}${attempt > 1 ? ` (tentativa ${attempt})` : ""}.`,
          });
          return;
        } catch (innerErr) {
          lastError = innerErr instanceof Error ? innerErr.message : String(innerErr);
          if (attempt < MAX_ATTEMPTS && isRetryable(lastError)) {
            await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
            continue;
          }
          throw innerErr;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRevealedData((prev) => ({
        ...prev,
        [dm.id]: { emails: [], phones: [], error: translateRevealError(msg) },
      }));
      toast({
        title: `Erro ao revelar (após ${attempt} tentativa(s))`,
        description: `${dm.fullName}: ${translateRevealError(lastError ?? msg)}`,
        variant: "destructive",
      });
    } finally {
      setRevealingIds((prev) => {
        const next = new Set(prev);
        next.delete(dm.id);
        return next;
      });
    }
  }


  const seniorityBadge = (s: string) => {
    const key = (s || "").toLowerCase();
    if (key.includes("c") && (key.includes("suite") || key.includes("level") || key === "cxo"))
      return "bg-violet-500/15 text-violet-300 border-violet-500/40";
    if (key.includes("vp") || key.includes("vice")) return "bg-blue-500/15 text-blue-300 border-blue-500/40";
    if (key.includes("director") || key.includes("head")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    if (key.includes("manager")) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    return "bg-muted text-muted-foreground border-border/50";
  };

  const searchMutation = useMutation({
    mutationFn: async () => {
      const departments = Array.from(selectedDepts);
      const { data, error } = await supabase.functions.invoke<SearchResponse>("lusha-search", {
        body: {
          company_name: companyName.trim(),
          departments,
          session_size: 20,
        },
      });
      if (error) throw error;
      return data as SearchResponse;
    },
    onSuccess: (data) => {
      setLastResult(data);
      setCookieAlert(null);
      toast({
        title: "Busca concluída",
        description: `${data.total_found} decisor(es) encontrado(s) em ${data.departments_searched.length} departamento(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["lusha-sessions"] });
      refetchSessions();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cookie/i.test(msg) || /503/.test(msg)) {
        setCookieAlert("A conexão com o Lusha está indisponível (cookie expirado ou ausente). Atualize o cookie em cookies_config.");
      }
      toast({
        title: "Erro na busca",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const canSearch = companyName.trim().length > 0 && selectedDepts.size > 0 && !searchMutation.isPending;

  const totalSelected = selectedDepts.size;

  function toggleDept(name: string, checked: boolean) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  const groupsMemo = useMemo(() => DEPT_GROUPS, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lusha Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Busca gratuita de decisores por empresa e departamento
            </p>
          </div>
        </div>
      </div>

      {/* Banner de alerta de cookie */}
      {cookieAlert && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-300">Conexão com Lusha indisponível</p>
            <p className="text-amber-200/80 mt-0.5">{cookieAlert}</p>
          </div>
        </div>
      )}

      {/* ── Nova seção: Busca por Domínio (Decisores) ── */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Busca por Domínio (Decisores)
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 border ml-1">
                  <Sparkles className="h-3 w-3 mr-1" /> GRATUITO
                </Badge>
              </CardTitle>
              <CardDescription>
                Consulta a API Decision Makers V3 da Lusha — retorna os principais decisores sem consumir créditos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="lusha-domain">Domínio da empresa</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-primary hover:text-primary"
                  onClick={applyExample}
                  disabled={dmMutation.isPending}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Preencher exemplo
                </Button>
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lusha-domain"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value);
                    if (domainError) setDomainError(null);
                  }}
                  onBlur={() => {
                    const { value, error } = validateDomain(domain);
                    if (value !== domain) setDomain(value);
                    setDomainError(error);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted && /https?:\/\//i.test(pasted)) {
                      e.preventDefault();
                      const { value, error } = validateDomain(pasted);
                      setDomain(value);
                      setDomainError(error);
                    }
                  }}
                  placeholder="Ex: natura.com.br"
                  className={`pl-9 ${domainError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={dmMutation.isPending}
                  aria-invalid={!!domainError}
                  aria-describedby="lusha-domain-help"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSearchDomain) dmMutation.mutate();
                  }}
                />
              </div>
              {domainError ? (
                <p className="text-xs text-destructive flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{domainError}</span>
                </p>
              ) : (
                <div id="lusha-domain-help" className="text-xs text-muted-foreground space-y-1">
                  <p>Informe o <strong>domínio do site oficial</strong> da empresa (sem <code className="text-[10px] px-1 rounded bg-muted">https://</code> e sem <code className="text-[10px] px-1 rounded bg-muted">www</code>).</p>
                  <p>
                    ✅ Aceitos: <code className="text-[10px] px-1 rounded bg-muted">natura.com.br</code>, <code className="text-[10px] px-1 rounded bg-muted">magazineluiza.com.br</code>, <code className="text-[10px] px-1 rounded bg-muted">nubank.com.br</code>
                  </p>
                  <p>
                    ❌ Não use: <code className="text-[10px] px-1 rounded bg-muted">linkedin.com/company/natura</code>, <code className="text-[10px] px-1 rounded bg-muted">facebook.com/natura</code>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lusha-linkedin">
                Página da empresa no LinkedIn <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lusha-linkedin"
                    value={linkedinCompanyUrl}
                    onChange={(e) => {
                      setLinkedinCompanyUrl(e.target.value);
                      if (linkedinError) setLinkedinError(null);
                    }}
                    onBlur={() => {
                      const { value, error } = validateLinkedinCompanyUrl(linkedinCompanyUrl);
                      if (value !== linkedinCompanyUrl) setLinkedinCompanyUrl(value);
                      setLinkedinError(error);
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (pasted && (/https?:\/\//i.test(pasted) || /\?/.test(pasted))) {
                        e.preventDefault();
                        const { value, error } = validateLinkedinCompanyUrl(pasted);
                        setLinkedinCompanyUrl(value);
                        setLinkedinError(error);
                      }
                    }}
                    placeholder="Ex: linkedin.com/company/natura"
                    className={`pl-9 ${linkedinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={dmMutation.isPending}
                    aria-invalid={!!linkedinError}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSearchDomain) dmMutation.mutate();
                    }}
                  />
                </div>
                {(() => {
                  const { value, error } = validateLinkedinCompanyUrl(linkedinCompanyUrl);
                  const isValid = !!value && !error;
                  const fullUrl = isValid ? `https://${value}` : "";
                  return (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={!isValid}
                        onClick={async () => {
                          if (!isValid) return;
                          try {
                            await navigator.clipboard.writeText(fullUrl);
                            setCopiedLinkedin(true);
                            toast({ title: "Link copiado", description: fullUrl });
                            setTimeout(() => setCopiedLinkedin(false), 1500);
                          } catch {
                            toast({ title: "Falha ao copiar", description: "Copie manualmente.", variant: "destructive" });
                          }
                        }}
                        title={isValid ? "Copiar link do LinkedIn" : "Informe uma URL válida do LinkedIn"}
                        className="shrink-0"
                      >
                        {copiedLinkedin ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        disabled={!isValid}
                        onClick={() => {
                          if (isValid) window.open(fullUrl, "_blank", "noopener,noreferrer");
                        }}
                        title={isValid ? "Abrir página no LinkedIn" : "Informe uma URL válida do LinkedIn"}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Abrir LinkedIn
                      </Button>
                    </>
                  );
                })()}
              </div>
              {linkedinError ? (
                <p className="text-xs text-destructive flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{linkedinError}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Cole a URL da página da empresa (o sistema remove <code className="text-[10px] px-1 rounded bg-muted">https://</code>, <code className="text-[10px] px-1 rounded bg-muted">www</code> e parâmetros).
                </p>
              )}
            </div>



            <div className="flex justify-end">
              <Button
                onClick={() => dmMutation.mutate()}
                disabled={!canSearchDomain}
                className="min-w-[180px]"
              >
                {dmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : rateLimitCountdown != null && rateLimitCountdown > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Aguarde {rateLimitCountdown}s
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar Decisores
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Indicador de progresso e status da busca ── */}
          {searchPhase !== "idle" && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg border p-3 space-y-2 ${
                searchPhase === "failed"
                  ? "border-destructive/40 bg-destructive/5"
                  : searchPhase === "done"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {searchPhase === "queued" && (<><Clock className="h-4 w-4 text-primary" /> Em fila</>)}
                  {searchPhase === "processing" && (<><Loader2 className="h-4 w-4 animate-spin text-primary" /> Processando</>)}
                  {searchPhase === "done" && (<><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Concluído</>)}
                  {searchPhase === "failed" && (<><XCircle className="h-4 w-4 text-destructive" /> Falhou</>)}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(searchProgress)}%</span>
              </div>
              <Progress
                value={searchProgress}
                className={
                  searchPhase === "failed"
                    ? "[&>div]:bg-destructive"
                    : searchPhase === "done"
                    ? "[&>div]:bg-emerald-500"
                    : ""
                }
              />
              {searchStatusMsg && (
                <p className={`text-xs ${searchPhase === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                  {searchStatusMsg}
                </p>
              )}
              {rateLimitCountdown != null && rateLimitCountdown > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <Clock className="h-3 w-3" />
                  <span>Aguarde <strong className="tabular-nums">{rateLimitCountdown}s</strong> antes de tentar novamente (limite da API Lusha).</span>
                </div>
              )}
            </div>
          )}

          {dmMutation.isPending && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!dmMutation.isPending && dmResults && (
            <div className="space-y-4">
              {dmResults.map((r) => (
                <div key={r.domain} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{r.domain}</span>
                    {r.error ? (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        {r.error}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{r.total ?? r.decisionMakers.length} decisores</Badge>
                    )}
                  </div>
                  {r.decisionMakers.length > 0 && (
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Cargo / Depto.</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Dados</TableHead>
                            <TableHead>LinkedIn</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.decisionMakers.map((dm) => (
                            <TableRow key={dm.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">{dm.fullName}</div>
                                  {dm.seniority && (
                                    <Badge variant="outline" className={seniorityBadge(dm.seniority)}>
                                      {dm.seniority}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm">{dm.jobTitle || "—"}</div>
                                  {dm.departments.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                       {dm.departments.slice(0, 2).map((d) => (
                                        <Badge key={d} variant="outline" className="border-border/50 text-xs">
                                          {d}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {dm.linkedinSkills && dm.linkedinSkills.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {dm.linkedinSkills.slice(0, 3).map((s) => (
                                        <Badge
                                          key={s}
                                          variant="secondary"
                                          className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground"
                                        >
                                          {s}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {dm.linkedinCertifications && dm.linkedinCertifications.length > 0 && (
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                       <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => setDetailsModal({ type: "certifications", dm })}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setDetailsModal({ type: "certifications", dm });
                                            }
                                          }}
                                          className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                                        >
                                          {dm.linkedinCertifications.slice(0, 2).map((c) => (
                                            <Badge
                                              key={c}
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                                            >
                                              🎓 {c}
                                            </Badge>
                                          ))}
                                          {dm.linkedinCertifications.length > 2 && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                                            >
                                              +{dm.linkedinCertifications.length - 2}
                                            </Badge>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold text-primary">
                                            🎓 Certificações ({dm.linkedinCertifications.length})
                                          </p>
                                          <ul className="text-xs space-y-0.5 list-disc list-inside">
                                            {dm.linkedinCertifications.map((c) => (
                                              <li key={c}>{c}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {dm.linkedinCourses && dm.linkedinCourses.length > 0 && (
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                       <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => setDetailsModal({ type: "courses", dm })}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setDetailsModal({ type: "courses", dm });
                                            }
                                          }}
                                          className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                                        >
                                          {dm.linkedinCourses.slice(0, 2).map((c) => (
                                            <Badge
                                              key={c}
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent-foreground border border-border/50"
                                            >
                                              📚 {c}
                                            </Badge>
                                          ))}
                                          {dm.linkedinCourses.length > 2 && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent-foreground border border-border/50"
                                            >
                                              +{dm.linkedinCourses.length - 2}
                                            </Badge>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold">
                                            📚 Cursos ({dm.linkedinCourses.length})
                                          </p>
                                          <ul className="text-xs space-y-0.5 list-disc list-inside">
                                            {dm.linkedinCourses.map((c) => (
                                              <li key={c}>{c}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {dm.linkedinAwards && dm.linkedinAwards.length > 0 && (
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                       <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => setDetailsModal({ type: "awards", dm })}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setDetailsModal({ type: "awards", dm });
                                            }
                                          }}
                                          className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                                        >
                                          {dm.linkedinAwards.slice(0, 2).map((a) => (
                                            <Badge
                                              key={a}
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            >
                                              🏆 {a}
                                            </Badge>
                                          ))}
                                          {dm.linkedinAwards.length > 2 && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            >
                                              +{dm.linkedinAwards.length - 2}
                                            </Badge>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold text-amber-500">
                                            🏆 Prêmios ({dm.linkedinAwards.length})
                                          </p>
                                          <ul className="text-xs space-y-0.5 list-disc list-inside">
                                            {dm.linkedinAwards.map((a) => (
                                              <li key={a}>{a}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="text-sm">{dm.company || "—"}</div>
                                {dm.location && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" /> {dm.location}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const rev = revealedData[dm.id];
                                  if (rev && !rev.error) {
                                    return (
                                      <div className="space-y-1 text-xs">
                                        {rev.emails.map((e, i) => (
                                          <div key={`e${i}`} className="flex items-center gap-1 text-foreground">
                                            <Mail className="h-3 w-3 text-primary" />
                                            <a href={`mailto:${e.email}`} className="hover:underline break-all">{e.email}</a>
                                          </div>
                                        ))}
                                        {rev.phones.map((p, i) => (
                                          <div key={`p${i}`} className="flex items-center gap-1 text-foreground">
                                            <Phone className="h-3 w-3 text-primary" />
                                            <a href={`tel:${p.number}`} className="hover:underline">{p.number}</a>
                                          </div>
                                        ))}
                                        {rev.emails.length === 0 && rev.phones.length === 0 && (
                                          <span className="text-muted-foreground">Sem dados retornados</span>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (rev?.error) {
                                    return (
                                      <div className="flex items-start gap-1 text-xs text-destructive max-w-[220px]">
                                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span>{rev.error}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-2">
                                      {dm.hasEmail && (
                                        <Badge variant="outline" className="border-border/50 gap-1">
                                          <Mail className="h-3 w-3" />
                                          {dm.emailCredits}c
                                        </Badge>
                                      )}
                                      {dm.hasPhone && (
                                        <Badge variant="outline" className="border-border/50 gap-1">
                                          <Phone className="h-3 w-3" />
                                          {dm.phoneCredits}c
                                        </Badge>
                                      )}
                                      {!dm.hasEmail && !dm.hasPhone && (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {dm.linkedin ? (
                                  <a
                                    href={dm.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                  >
                                    Perfil <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const isRevealing = revealingIds.has(dm.id);
                                  const rev = revealedData[dm.id];
                                  const isRevealed = !!rev && !rev.error;
                                  const hasError = !!rev?.error;
                                  const disabled = isRevealing || isRevealed || (!dm.hasEmail && !dm.hasPhone);
                                  const handleClick = () => {
                                    if (hasError) {
                                      // limpa erro antes de re-tentar
                                      setRevealedData((prev) => {
                                        const next = { ...prev };
                                        delete next[dm.id];
                                        return next;
                                      });
                                      // aguarda o próximo tick para o estado propagar
                                      setTimeout(() => handleReveal(dm), 0);
                                    } else {
                                      handleReveal(dm);
                                    }
                                  };
                                  return (
                                    <Button
                                      size="sm"
                                      variant={isRevealed ? "ghost" : hasError ? "destructive" : "outline"}
                                      onClick={handleClick}
                                      disabled={disabled}
                                    >
                                      {isRevealing ? (
                                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Revelando…</>
                                      ) : isRevealed ? (
                                        "Revelado"
                                      ) : hasError ? (
                                        <><AlertTriangle className="h-3 w-3 mr-1" /> Tentar novamente</>
                                      ) : (
                                        "Revelar"
                                      )}
                                    </Button>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
              {dmResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum decisor retornado para este domínio.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de busca */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Nova busca
          </CardTitle>
          <CardDescription>
            Selecione a empresa alvo e um ou mais departamentos para localizar decisores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Empresa */}
          <div className="space-y-2">
            <Label htmlFor="lusha-company">Nome da empresa</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="lusha-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Nestlé, Ambev, Lactalis..."
                className="pl-9"
                disabled={searchMutation.isPending}
              />
            </div>
          </div>

          {/* Departamentos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Departamentos {totalSelected > 0 && <span className="text-muted-foreground font-normal">({totalSelected} selecionado{totalSelected > 1 ? "s" : ""})</span>}</Label>
              {totalSelected > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDepts(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupsMemo.map((group) => (
                <div
                  key={group.label}
                  className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const id = `dept-${item}`;
                      const checked = selectedDepts.has(item);
                      return (
                        <label
                          key={item}
                          htmlFor={id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(c) => toggleDept(item, c === true)}
                            disabled={searchMutation.isPending}
                          />
                          <span className="text-sm">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ação */}
          <div className="flex items-center justify-end gap-3">
            <Button
              onClick={() => searchMutation.mutate()}
              disabled={!canSearch}
              className="min-w-[180px]"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando decisores...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Decisores
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados / Histórico */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results" className="gap-2">
            <Users2 className="h-4 w-4" /> Resultados
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-1">{contacts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {lastResult
                  ? `Decisores de ${lastResult.company_resolved}`
                  : activeSessionId
                    ? "Decisores da última sessão"
                    : "Nenhuma busca ainda"}
              </CardTitle>
              {lastResult?.departments_skipped && lastResult.departments_skipped.length > 0 && (
                <CardDescription className="text-amber-400">
                  Departamentos não mapeados: {lastResult.departments_skipped.join(", ")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {loadingContacts ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Carregando contatos...
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Execute uma busca para ver decisores aqui.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>LinkedIn</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.job_title ?? "—"}</TableCell>
                          <TableCell>
                            {c.department_pt ? (
                              <Badge variant="outline" className="border-border/50">
                                {c.department_pt}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {c.linkedin_url ? (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                Perfil <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={c.enrichment_status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Últimas sessões de busca</CardTitle>
              <CardDescription>Histórico das 10 buscas mais recentes.</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma sessão registrada.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Departamentos</TableHead>
                        <TableHead className="text-center">Encontrados</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.company_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(s.departments_requested ?? []).slice(0, 3).map((d) => (
                                <Badge key={d} variant="outline" className="border-border/50 text-xs">
                                  {d}
                                </Badge>
                              ))}
                              {(s.departments_requested?.length ?? 0) > 3 && (
                                <Badge variant="outline" className="border-border/50 text-xs">
                                  +{(s.departments_requested?.length ?? 0) - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {s.total_found ?? 0}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={s.status} />
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailsModal} onOpenChange={(o) => !o && setDetailsModal(null)}>
        <DialogContent className="max-w-lg">
          {detailsModal && (() => {
            const { type, dm } = detailsModal;
            const config = {
              certifications: {
                emoji: "🎓",
                title: "Certificações",
                items: dm.linkedinCertifications ?? [],
                color: "text-primary",
              },
              courses: {
                emoji: "📚",
                title: "Cursos",
                items: dm.linkedinCourses ?? [],
                color: "text-foreground",
              },
              awards: {
                emoji: "🏆",
                title: "Prêmios",
                items: dm.linkedinAwards ?? [],
                color: "text-amber-500",
              },
            }[type];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className={`flex items-center gap-2 ${config.color}`}>
                    <span className="text-2xl">{config.emoji}</span>
                    {config.title} ({config.items.length})
                  </DialogTitle>
                  <DialogDescription>
                    {dm.fullName}
                    {dm.jobTitle && ` — ${dm.jobTitle}`}
                    {dm.company && ` @ ${dm.company}`}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-2 pr-4">
                  {config.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nenhum item disponível.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {config.items.map((item, idx) => (
                        <li
                          key={`${item}-${idx}`}
                          className="flex items-start gap-3 p-3 rounded-md border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-lg leading-none mt-0.5">{config.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium break-words">{item}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            #{idx + 1}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LushaIntelligenceView;
