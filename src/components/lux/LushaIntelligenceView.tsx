import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Search, Users2, AlertTriangle, Loader2, ExternalLink, History, Building2, Globe, Mail, Phone, Sparkles, MapPin, Link2, Copy, CheckCircle2, XCircle, Clock, X, RotateCw, Trash2, Settings2, Bell } from "lucide-react";
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
  type SearchPhase = "idle" | "queued" | "processing" | "done" | "failed" | "cancelled";
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("idle");
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatusMsg, setSearchStatusMsg] = useState<string>("");
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const searchStartedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [copiedLinkedin, setCopiedLinkedin] = useState(false);

  // ── Histórico de buscas por domínio (sincronizado no Supabase) ──
  type DMHistoryEntry = {
    id: string;
    domain: string;
    linkedin: string | null;
    startedAt: string;
    finishedAt: string;
    status: "done" | "failed" | "cancelled" | "processing" | "queued";
    total: number;
    message?: string | null;
    durationMs: number | null;
  };

  type DMHistoryRow = {
    id: string;
    domain: string;
    linkedin_url: string | null;
    status: string;
    decision_makers_count: number;
    error_message: string | null;
    duration_ms: number | null;
    created_at: string;
    updated_at: string;
  };

  const rowToEntry = (r: DMHistoryRow): DMHistoryEntry => ({
    id: r.id,
    domain: r.domain,
    linkedin: r.linkedin_url,
    startedAt: r.created_at,
    finishedAt: r.updated_at,
    status: (["done", "failed", "cancelled", "processing", "queued"].includes(r.status)
      ? r.status
      : "failed") as DMHistoryEntry["status"],
    total: r.decision_makers_count ?? 0,
    message: r.error_message,
    durationMs: r.duration_ms ?? null,
  });

  const { data: dmHistory = [] } = useQuery({
    queryKey: ["lusha-dm-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lusha_dm_search_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as DMHistoryRow[]).map(rowToEntry);
    },
    staleTime: 30_000,
  });

  // Sincronização em tempo real entre abas/dispositivos
  useEffect(() => {
    const channel = supabase
      .channel("lusha-dm-history-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lusha_dm_search_history" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["lusha-dm-history"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Ref do id da linha da busca em andamento — permite atualizar o mesmo registro
  // conforme a busca avança pelas fases (queued → processing → done/failed/cancelled).
  const currentHistoryIdRef = useRef<string | null>(null);

  const startHistory = useCallback(
    async (entry: { domain: string; linkedin: string | null }): Promise<string | null> => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (!uid) return null;
        const { data, error } = await supabase
          .from("lusha_dm_search_history")
          .insert({
            user_id: uid,
            domain: entry.domain,
            linkedin_url: entry.linkedin,
            status: "queued",
            decision_makers_count: 0,
            duration_ms: 0,
          })
          .select("id")
          .single();
        if (error) return null;
        queryClient.invalidateQueries({ queryKey: ["lusha-dm-history"] });
        return data?.id ?? null;
      } catch {
        return null;
      }
    },
    [queryClient],
  );

  const updateHistory = useCallback(
    async (
      id: string | null,
      patch: {
        status: DMHistoryEntry["status"];
        total?: number;
        message?: string | null;
        startedAt?: string;
      },
    ) => {
      if (!id) return;
      try {
        const payload: Record<string, unknown> = { status: patch.status };
        if (patch.total != null) payload.decision_makers_count = patch.total;
        if (patch.message !== undefined) payload.error_message = patch.message;
        if (patch.startedAt) {
          payload.duration_ms = Math.max(0, Date.now() - new Date(patch.startedAt).getTime());
        }
        await supabase.from("lusha_dm_search_history").update(payload).eq("id", id);
        queryClient.invalidateQueries({ queryKey: ["lusha-dm-history"] });
      } catch {
        /* silencioso */
      }
    },
    [queryClient],
  );

  const clearHistory = useCallback(async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return;
      await supabase.from("lusha_dm_search_history").delete().eq("user_id", uid);
      queryClient.invalidateQueries({ queryKey: ["lusha-dm-history"] });
    } catch { /* ignore */ }
  }, [queryClient]);

  // ── Preferências de notificações (persistidas em localStorage) ──
  type NotifPrefs = {
    nativeEnabled: boolean;      // notificação nativa do navegador
    inAppEnabled: boolean;       // grava no centro de notificações do app
    hiddenTabOnly: boolean;      // só notifica se a aba estiver oculta
    notifyOnFailure: boolean;    // notificar em falhas
    notifyOnCancel: boolean;     // notificar em cancelamentos
    thresholdMs: number;         // duração mínima para considerar "longa"
    repeatUntilFocus: boolean;   // renotifica a cada N segundos até o usuário focar
    repeatIntervalMs: number;    // intervalo do repeat
  };
  const NOTIF_PREFS_KEY = "lusha-dm:notif-prefs:v1";
  const DEFAULT_NOTIF_PREFS: NotifPrefs = {
    nativeEnabled: true,
    inAppEnabled: true,
    hiddenTabOnly: false,
    notifyOnFailure: true,
    notifyOnCancel: false,
    thresholdMs: 15_000,
    repeatUntilFocus: false,
    repeatIntervalMs: 30_000,
  };
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(NOTIF_PREFS_KEY) : null;
      if (!raw) return DEFAULT_NOTIF_PREFS;
      const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
      return { ...DEFAULT_NOTIF_PREFS, ...parsed };
    } catch { return DEFAULT_NOTIF_PREFS; }
  });
  useEffect(() => {
    try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notifPrefs)); } catch { /* ignore */ }
  }, [notifPrefs]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const repeatTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const clearRepeatTimer = useCallback((key: string) => {
    const t = repeatTimersRef.current.get(key);
    if (t) { clearInterval(t); repeatTimersRef.current.delete(key); }
  }, []);
  useEffect(() => {
    const onFocus = () => {
      for (const [, t] of repeatTimersRef.current) clearInterval(t);
      repeatTimersRef.current.clear();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) onFocus(); });
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ── Notificações de buscas longas ──
  const [browserNotifPermission, setBrowserNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const requestBrowserNotifPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      toast({ title: "Notificações indisponíveis", description: "Seu navegador não suporta notificações.", variant: "destructive" });
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setBrowserNotifPermission(p);
      if (p === "granted") {
        toast({ title: "Notificações ativadas", description: "Você será avisado quando buscas longas terminarem." });
      }
    } catch { /* ignore */ }
  }, []);

  const notifyLongSearch = useCallback(
    async (params: { domain: string; status: "done" | "failed" | "cancelled"; elapsedMs: number; total?: number; message?: string | null; historyId?: string | null }) => {
      const { domain: d, status, elapsedMs, total, message, historyId } = params;
      if (status === "failed" && !notifPrefs.notifyOnFailure) return;
      if (status === "cancelled" && !notifPrefs.notifyOnCancel) return;

      const isLong = elapsedMs >= notifPrefs.thresholdMs;
      const wasAway = typeof document !== "undefined" && document.hidden;
      const shouldNotify = notifPrefs.hiddenTabOnly ? wasAway : (isLong || wasAway);
      if (!shouldNotify) return;

      const seconds = (elapsedMs / 1000).toFixed(1);
      const title =
        status === "done" ? `Busca concluída — ${d}`
        : status === "failed" ? `Busca falhou — ${d}`
        : `Busca cancelada — ${d}`;
      const description =
        status === "done" ? `${total ?? 0} decisor(es) localizado(s) em ${seconds}s.`
        : status === "failed" ? `${message ?? "Erro desconhecido"} (após ${seconds}s).`
        : `Interrompida após ${seconds}s.`;

      // Deep-link direto para o histórico/resultado
      const deepLink = `/?view=lusha&tab=history${historyId ? `&historyId=${encodeURIComponent(historyId)}` : ""}`;

      const fireNative = () => {
        try {
          if (
            notifPrefs.nativeEnabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            const n = new Notification(title, {
              body: description,
              tag: `lusha-dm-${d}`,
              icon: "/favicon.ico",
              data: { deepLink },
            });
            n.onclick = () => {
              try {
                window.focus();
                n.close();
                // navega mantendo SPA
                window.location.assign(deepLink);
              } catch { /* noop */ }
            };
          }
        } catch { /* ignore */ }
      };
      fireNative();

      // Repetição até o usuário focar
      if (notifPrefs.repeatUntilFocus && document.hidden) {
        clearRepeatTimer(d);
        const interval = Math.max(5_000, notifPrefs.repeatIntervalMs);
        const t = setInterval(() => {
          if (!document.hidden) { clearRepeatTimer(d); return; }
          fireNative();
        }, interval);
        repeatTimersRef.current.set(d, t);
      }

      // Centro de notificações do app
      if (notifPrefs.inAppEnabled) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes?.user?.id;
          if (!uid) return;
          await supabase.from("notifications").insert({
            user_id: uid,
            title,
            message: description,
            type: status === "failed" ? "system" : "enrichment",
            metadata: {
              source: "lusha_dm",
              domain: d,
              status,
              elapsed_ms: elapsedMs,
              total: total ?? 0,
              deep_link: deepLink,
              history_id: historyId ?? null,
            } as unknown as never,
          });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
        } catch { /* ignore */ }
      }
    },
    [queryClient, notifPrefs, clearRepeatTimer],
  );




  // ── Filtros do histórico ──
  const [historyQ, setHistoryQ] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"all" | DMHistoryEntry["status"]>("all");
  const [historyFrom, setHistoryFrom] = useState<string>(""); // yyyy-mm-dd
  const [historyTo, setHistoryTo] = useState<string>("");

  const filteredHistory = useMemo(() => {
    const q = historyQ.trim().toLowerCase();
    const fromTs = historyFrom ? new Date(historyFrom + "T00:00:00").getTime() : null;
    const toTs = historyTo ? new Date(historyTo + "T23:59:59").getTime() : null;
    return dmHistory.filter((h) => {
      if (q && !h.domain.toLowerCase().includes(q) && !(h.linkedin ?? "").toLowerCase().includes(q)) return false;
      if (historyStatus !== "all" && h.status !== historyStatus) return false;
      const t = new Date(h.finishedAt).getTime();
      if (fromTs != null && t < fromTs) return false;
      if (toTs != null && t > toTs) return false;
      return true;
    });
  }, [dmHistory, historyQ, historyStatus, historyFrom, historyTo]);

  // ── Tempo médio por domínio (apenas buscas concluídas com sucesso) ──
  const avgDurationByDomain = useMemo(() => {
    const acc = new Map<string, { total: number; count: number }>();
    for (const h of dmHistory) {
      if (h.status !== "done" || !h.durationMs || h.durationMs <= 0) continue;
      const prev = acc.get(h.domain) ?? { total: 0, count: 0 };
      prev.total += h.durationMs;
      prev.count += 1;
      acc.set(h.domain, prev);
    }
    const map = new Map<string, number>();
    for (const [k, v] of acc.entries()) map.set(k, v.total / v.count);
    return map;
  }, [dmHistory]);

  const formatDuration = (ms: number | null): string => {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  };

  // ── Auto-retry de buscas falhadas (respeita fila + rate-limit) ──
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(false);
  const autoRetryAttemptedRef = useRef<Set<string>>(new Set());
  const [autoRetryQueue, setAutoRetryQueue] = useState<string[]>([]);

  // Popula a fila com domínios únicos que falharam e ainda não foram tentados nesta sessão
  useEffect(() => {
    if (!autoRetryEnabled) {
      setAutoRetryQueue([]);
      return;
    }
    const failedDomains: string[] = [];
    const seen = new Set<string>();
    for (const h of dmHistory) {
      if (h.status !== "failed") continue;
      if (seen.has(h.domain)) continue;
      seen.add(h.domain);
      if (autoRetryAttemptedRef.current.has(h.domain)) continue;
      failedDomains.push(h.domain);
    }
    setAutoRetryQueue(failedDomains);
  }, [autoRetryEnabled, dmHistory]);


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

  // ── Cancela a busca em andamento ──
  const cancelSearch = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

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

      // Setup abort + timing
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();
      searchStartedAtRef.current = startedAt;
      setSearchElapsedMs(0);

      // Sequência de fases granulares — atualiza em tempo real enquanto a Lusha responde
      setSearchPhase("queued");
      setSearchProgress(8);
      setSearchStatusMsg("Enfileirando requisição...");

      // Registra o evento "queued" no histórico já com id — as fases seguintes
      // atualizam o mesmo registro para que outros dispositivos acompanhem.
      currentHistoryIdRef.current = await startHistory({
        domain: d.value,
        linkedin: l.value || null,
      });

      const phaseTimers: number[] = [];
      phaseTimers.push(window.setTimeout(() => {
        setSearchPhase("processing");
        setSearchStatusMsg("Autenticando com a API Lusha...");
        setSearchProgress(22);
        void updateHistory(currentHistoryIdRef.current, {
          status: "processing",
          startedAt: new Date(startedAt).toISOString(),
        });
      }, 250));
      phaseTimers.push(window.setTimeout(() => {
        setSearchStatusMsg("Resolvendo empresa pelo domínio...");
        setSearchProgress(38);
      }, 900));
      phaseTimers.push(window.setTimeout(() => {
        setSearchStatusMsg("Buscando decisores (Decision Makers V3)...");
        setSearchProgress(55);
      }, 2200));
      phaseTimers.push(window.setTimeout(() => {
        setSearchStatusMsg("Recebendo resposta e normalizando dados...");
        setSearchProgress(72);
      }, 4500));
      phaseTimers.push(window.setTimeout(() => {
        setSearchStatusMsg("Persistindo contatos no banco...");
        setSearchProgress(85);
      }, 7500));

      const progressTimer = window.setInterval(() => {
        setSearchProgress((p) => (p < 92 ? p + Math.max(0.5, (93 - p) / 20) : p));
        if (searchStartedAtRef.current != null) {
          setSearchElapsedMs(Date.now() - searchStartedAtRef.current);
        }
      }, 200);

      const cleanup = () => {
        phaseTimers.forEach(clearTimeout);
        clearInterval(progressTimer);
      };

      try {
        const invokePromise = supabase.functions.invoke<DMResponse>("lusha-decision-makers", {
          body: {
            domains: [d.value],
            company_linkedin_url: l.value || null,
          },
        });

        // Corrida entre a invocação e o cancelamento
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            const err = new Error("cancelled_by_user");
            (err as unknown as { cancelled: boolean }).cancelled = true;
            reject(err);
          }, { once: true });
        });

        const { data, error } = await Promise.race([invokePromise, abortPromise]) as Awaited<typeof invokePromise>;

        if (error) {
          let retryAfter: number | null = null;
          let friendly: string | null = null;
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.clone().json();
              if (body?.retry_after_seconds != null) retryAfter = Number(body.retry_after_seconds);
              if (body?.error?.code === "lusha_rate_limited") friendly = body?.error?.message ?? null;
              else if (body?.error?.message) friendly = body.error.message;
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
        cleanup();
        abortRef.current = null;
      }
    },
    onSuccess: (data) => {
      setDmResults(data.results ?? []);
      setDmRequestId(data.requestId ?? null);
      setRevealedData({});
      setRevealingIds(new Set());
      setSearchPhase("done");
      setSearchProgress(100);
      const total = data.totalDecisionMakers ?? 0;
      setSearchStatusMsg(`${total} decisor(es) localizado(s).`);
      const elapsed = searchStartedAtRef.current ? Date.now() - searchStartedAtRef.current : 0;
      updateHistory(currentHistoryIdRef.current, {
        status: "done",
        total,
        message: null,
        startedAt: new Date(searchStartedAtRef.current ?? Date.now()).toISOString(),
      });
      void notifyLongSearch({ domain, status: "done", elapsedMs: elapsed, total, historyId: currentHistoryIdRef.current });
      currentHistoryIdRef.current = null;
      toast({
        title: "Decisores encontrados",
        description: `${total} decisor(es) localizado(s) — 0 créditos consumidos.`,
      });

    },
    onError: (err: unknown) => {
      const cancelled = (err as { cancelled?: boolean })?.cancelled === true;
      const msg = err instanceof Error ? err.message : String(err);
      const wait = (err as { rateLimit?: number })?.rateLimit;

      if (cancelled) {
        setSearchPhase("cancelled");
        setSearchProgress(100);
        setSearchStatusMsg("Busca cancelada pelo usuário.");
        updateHistory(currentHistoryIdRef.current, {
          status: "cancelled",
          total: 0,
          message: "Cancelada pelo usuário",
          startedAt: new Date(searchStartedAtRef.current ?? Date.now()).toISOString(),
        });
        const elapsedCancel = searchStartedAtRef.current ? Date.now() - searchStartedAtRef.current : 0;
        void notifyLongSearch({ domain, status: "cancelled", elapsedMs: elapsedCancel, historyId: currentHistoryIdRef.current });
        currentHistoryIdRef.current = null;
        toast({ title: "Busca cancelada", description: "Você pode iniciar uma nova busca a qualquer momento." });
        return;
      }

      setSearchPhase("failed");
      setSearchProgress(100);
      setSearchStatusMsg(msg);
      const elapsedFail = searchStartedAtRef.current ? Date.now() - searchStartedAtRef.current : 0;
      updateHistory(currentHistoryIdRef.current, {
        status: "failed",
        total: 0,
        message: msg,
        startedAt: new Date(searchStartedAtRef.current ?? Date.now()).toISOString(),
      });
      void notifyLongSearch({ domain, status: "failed", elapsedMs: elapsedFail, message: msg, historyId: currentHistoryIdRef.current });
      currentHistoryIdRef.current = null;

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

  // ── Processador do auto-retry: dispara o próximo item da fila quando livre ──
  useEffect(() => {
    if (!autoRetryEnabled) return;
    if (autoRetryQueue.length === 0) return;
    if (dmMutation.isPending) return;
    if (rateLimitCountdown != null && rateLimitCountdown > 0) return;
    const nextDomain = autoRetryQueue[0];
    if (!nextDomain) return;
    // marca como tentado e remove da fila antes de disparar (evita loop)
    autoRetryAttemptedRef.current.add(nextDomain);
    setAutoRetryQueue((q) => q.slice(1));
    setDomain(nextDomain);
    setLinkedinCompanyUrl("");
    setDomainError(null);
    setLinkedinError(null);
    toast({
      title: "Auto-retry",
      description: `Reprocessando "${nextDomain}"…`,
    });
    // pequeno delay para o state settlar
    const t = setTimeout(() => dmMutation.mutate(), 150);
    return () => clearTimeout(t);
  }, [autoRetryEnabled, autoRetryQueue, dmMutation.isPending, rateLimitCountdown, dmMutation]);




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



            <div className="flex justify-end gap-2">
              {dmMutation.isPending && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelSearch}
                  className="min-w-[130px]"
                  aria-label="Cancelar busca em andamento"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
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
              aria-atomic="true"
              className={`rounded-lg border p-3 space-y-2 ${
                searchPhase === "failed"
                  ? "border-destructive/40 bg-destructive/5"
                  : searchPhase === "cancelled"
                  ? "border-muted-foreground/30 bg-muted/40"
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
                  {searchPhase === "cancelled" && (<><X className="h-4 w-4 text-muted-foreground" /> Cancelada</>)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  {(dmMutation.isPending || searchPhase === "done" || searchPhase === "failed" || searchPhase === "cancelled") && (
                    <span aria-label="Tempo decorrido" title="Duração desta busca (duration_ms)">
                      ⏱ {formatDuration(searchElapsedMs)}
                    </span>
                  )}
                  {avgDurationByDomain.get(domain) != null && (
                    <span
                      aria-label="Média histórica deste domínio"
                      title="Tempo médio das buscas anteriores concluídas para este domínio"
                      className="hidden sm:inline"
                    >
                      μ {formatDuration(avgDurationByDomain.get(domain) ?? null)}
                    </span>
                  )}
                  <span>{Math.round(searchProgress)}%</span>
                </div>
              </div>
              <Progress
                value={searchProgress}
                className={
                  searchPhase === "failed"
                    ? "[&>div]:bg-destructive"
                    : searchPhase === "cancelled"
                    ? "[&>div]:bg-muted-foreground"
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
              {dmMutation.isPending && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={cancelSearch}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" /> Cancelar consulta
                  </Button>
                </div>
              )}
              {rateLimitCountdown != null && rateLimitCountdown > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <Clock className="h-3 w-3" />
                  <span>Aguarde <strong className="tabular-nums">{rateLimitCountdown}s</strong> antes de tentar novamente (limite da API Lusha).</span>
                </div>
              )}
            </div>
          )}

          {/* ── Histórico local de buscas por domínio ── */}
          {dmHistory.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-card/40">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Histórico de buscas{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({filteredHistory.length}/{dmHistory.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={autoRetryEnabled}
                      onCheckedChange={(v) => setAutoRetryEnabled(v === true)}
                      className="h-3.5 w-3.5"
                    />
                    Auto-retry de falhas
                  </label>
                  {browserNotifPermission !== "granted" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={requestBrowserNotifPermission}
                      className="h-7 text-xs text-muted-foreground hover:text-primary"
                      title="Receber notificações do navegador quando buscas longas terminarem"
                    >
                      🔔 Ativar notificações
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    title="Limpar histórico"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Limpar
                  </Button>
                </div>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
                <Input
                  placeholder="Buscar por domínio ou LinkedIn…"
                  value={historyQ}
                  onChange={(e) => setHistoryQ(e.target.value)}
                  className="h-8 text-xs md:col-span-2"
                />
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value as typeof historyStatus)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label="Filtrar por status"
                >
                  <option value="all">Todos os status</option>
                  <option value="done">Concluído</option>
                  <option value="failed">Falhou</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="processing">Processando</option>
                  <option value="queued">Em fila</option>
                </select>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                    className="h-8 text-xs"
                    aria-label="Data inicial"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="date"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                    className="h-8 text-xs"
                    aria-label="Data final"
                  />
                </div>
              </div>

              <ScrollArea className="max-h-64">
                {filteredHistory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum item corresponde aos filtros atuais.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {filteredHistory.map((h) => {
                      const badge =
                        h.status === "done"
                          ? { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Concluído", Icon: CheckCircle2 }
                          : h.status === "cancelled"
                          ? { cls: "bg-muted text-muted-foreground border-border/50", label: "Cancelado", Icon: X }
                          : h.status === "processing"
                          ? { cls: "bg-primary/15 text-primary border-primary/30", label: "Processando", Icon: Loader2 }
                          : h.status === "queued"
                          ? { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Em fila", Icon: Clock }
                          : { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Falhou", Icon: XCircle };
                      const queuedForRetry = autoRetryQueue.includes(h.domain);
                      return (
                        <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{h.domain}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.cls}`}>
                                <badge.Icon className="h-3 w-3 mr-1" />
                                {badge.label}
                              </Badge>
                              {h.status === "done" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {h.total} decisor{h.total === 1 ? "" : "es"}
                                </Badge>
                              )}
                              {h.durationMs != null && h.durationMs > 0 && (h.status === "done" || h.status === "failed" || h.status === "cancelled") && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-border/60 text-muted-foreground"
                                  title="duration_ms desta busca"
                                >
                                  <Clock className="h-3 w-3 mr-1" /> {formatDuration(h.durationMs)}
                                </Badge>
                              )}
                              {queuedForRetry && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                  <Clock className="h-3 w-3 mr-1" /> Aguardando retry
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {formatDistanceToNow(new Date(h.finishedAt), { addSuffix: true, locale: ptBR })}
                              {avgDurationByDomain.get(h.domain) != null && (
                                <> · <span title="Tempo médio deste domínio">μ {formatDuration(avgDurationByDomain.get(h.domain) ?? null)}</span></>
                              )}
                              {h.linkedin && <> · <span className="truncate">{h.linkedin}</span></>}
                              {h.message && <> · <span className="text-destructive/80">{h.message}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              title="Preencher campos com este domínio"
                              onClick={() => {
                                setDomain(h.domain);
                                setLinkedinCompanyUrl(h.linkedin ?? "");
                                setDomainError(null);
                                setLinkedinError(null);
                              }}
                            >
                              Retomar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              title="Preencher e buscar novamente"
                              disabled={dmMutation.isPending || (rateLimitCountdown != null && rateLimitCountdown > 0)}
                              onClick={() => {
                                setDomain(h.domain);
                                setLinkedinCompanyUrl(h.linkedin ?? "");
                                setDomainError(null);
                                setLinkedinError(null);
                                setTimeout(() => dmMutation.mutate(), 0);
                              }}
                            >
                              <RotateCw className="h-3 w-3 mr-1" /> Reprocessar
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
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
