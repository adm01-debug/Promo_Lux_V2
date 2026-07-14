import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users2, AlertTriangle, Loader2, ExternalLink, History, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
    </div>
  );
};

export default LushaIntelligenceView;
