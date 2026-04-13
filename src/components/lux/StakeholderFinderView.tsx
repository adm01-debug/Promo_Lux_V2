import { useState, useMemo } from "react";
import { ViewSkeleton } from "@/components/lux/ViewSkeleton";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_STAKEHOLDERS } from "@/lib/demoData";
import { DataError } from "@/components/lux/DataError";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Search, Filter, Crown, Briefcase, Building2, Mail, Phone,
  X, Zap, UserCheck, UserX, Shield, Target, TrendingUp, Eye,
} from "lucide-react";
import { LinkedinIcon as Linkedin } from "@/components/lux/icons/LinkedinIcon";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AnimatePresence } from "framer-motion";
import { StakeholderCard } from "./stakeholders/StakeholderCard";
import { StakeholderListRow } from "./stakeholders/StakeholderListRow";

interface Stakeholder {
  id: string;
  full_name: string;
  role: string | null;
  department: string | null;
  seniority: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  confidence_score: number | null;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

const seniorityConfig: Record<string, { label: string; icon: React.ReactNode; color: string; priority: number }> = {
  "c-level": { label: "C-Level", icon: <Crown className="h-3 w-3" />, color: "bg-primary/20 text-primary border-primary/40", priority: 1 },
  "vp": { label: "VP", icon: <Shield className="h-3 w-3" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/40", priority: 2 },
  "director": { label: "Diretor", icon: <Target className="h-3 w-3" />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", priority: 3 },
  "manager": { label: "Gerente", icon: <Briefcase className="h-3 w-3" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/40", priority: 4 },
  "coordinator": { label: "Coordenador", icon: <UserCheck className="h-3 w-3" />, color: "bg-violet-500/20 text-violet-400 border-violet-500/40", priority: 5 },
  "senior": { label: "Sênior", icon: <TrendingUp className="h-3 w-3" />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40", priority: 6 },
  "analyst": { label: "Analista", icon: <Eye className="h-3 w-3" />, color: "bg-muted text-muted-foreground border-border/50", priority: 7 },
  "unknown": { label: "Outro", icon: <Users className="h-3 w-3" />, color: "bg-muted text-muted-foreground border-border/50", priority: 8 },
};

const getSeniority = (s: string | null) => seniorityConfig[s || "unknown"] || seniorityConfig["unknown"];

export const StakeholderFinderView = () => {
  const { isDemoMode } = useDemo();
  const [search, setSearch] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [selectedSeniority, setSelectedSeniority] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: stakeholders = [], isLoading, error: stakeholdersError, refetch } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: isDemoMode
      ? () => DEMO_STAKEHOLDERS as Stakeholder[]
      : async () => {
          const { data, error } = await supabase.from("stakeholders").select("*").order("confidence_score", { ascending: false });
          if (error) throw error;
          return data as Stakeholder[];
        },
  });

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    stakeholders.forEach((s) => { const dept = s.department || "Outro"; map.set(dept, (map.get(dept) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [stakeholders]);

  const seniorityGroups = useMemo(() => {
    const map = new Map<string, number>();
    stakeholders.forEach((s) => { const sen = s.seniority || "unknown"; map.set(sen, (map.get(sen) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => (seniorityConfig[a[0]]?.priority ?? 99) - (seniorityConfig[b[0]]?.priority ?? 99));
  }, [stakeholders]);

  const filtered = useMemo(() => {
    return stakeholders.filter((s) => {
      const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || (s.role && s.role.toLowerCase().includes(search.toLowerCase())) || (s.department && s.department.toLowerCase().includes(search.toLowerCase())) || (s.email && s.email.toLowerCase().includes(search.toLowerCase())) || (s.tags && s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
      const matchDept = selectedDepts.size === 0 || selectedDepts.has(s.department || "Outro");
      const matchSen = selectedSeniority.size === 0 || selectedSeniority.has(s.seniority || "unknown");
      return matchSearch && matchDept && matchSen;
    });
  }, [stakeholders, search, selectedDepts, selectedSeniority]);

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast({ title: "Email copiado!", description: email });
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const clearFilters = () => { setSelectedDepts(new Set()); setSelectedSeniority(new Set()); setSearch(""); };
  const totalFilters = selectedDepts.size + selectedSeniority.size;

  const decisores = stakeholders.filter((s) => ["c-level", "vp", "director"].includes(s.seniority || "")).length;
  const comEmail = stakeholders.filter((s) => s.email).length;
  const comLinkedin = stakeholders.filter((s) => s.linkedin_url).length;
  const avgScore = stakeholders.length > 0 ? Math.round(stakeholders.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / stakeholders.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Stakeholder Finder</h2>
          <p className="text-sm text-muted-foreground mt-1">Descubra decisores e influenciadores — {stakeholders.length} stakeholders mapeados</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>Grid</button>
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>Lista</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Decisores", value: decisores, sub: "C-Level + VP + Dir", color: "text-primary", icon: <Crown className="h-4 w-4 text-primary" /> },
          { label: "Com Email", value: comEmail, sub: `${Math.round((comEmail / Math.max(stakeholders.length, 1)) * 100)}% cobertura`, color: "text-success", icon: <Mail className="h-4 w-4 text-success" /> },
          { label: "Com LinkedIn", value: comLinkedin, sub: `${Math.round((comLinkedin / Math.max(stakeholders.length, 1)) * 100)}% perfis`, color: "text-blue-400", icon: <Linkedin className="h-4 w-4 text-blue-400" /> },
          { label: "Score Médio", value: avgScore, sub: "Confiança de dados", color: "text-primary", icon: <Zap className="h-4 w-4 text-primary" /> },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-4 group hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>{stat.icon}</div>
            <p className={`text-2xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass rounded-lg p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Filter className="h-3.5 w-3.5 text-primary" /> Filtros</span>
              {totalFilters > 0 && <button onClick={clearFilters} className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><X className="h-3 w-3" /> Limpar ({totalFilters})</button>}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Nome, cargo, email..." className="pl-8 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Senioridade</p>
              <div className="space-y-1">
                {seniorityGroups.map(([key, count]) => {
                  const config = getSeniority(key);
                  return (
                    <button key={key} onClick={() => toggleSet(selectedSeniority, key, setSelectedSeniority)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${selectedSeniority.has(key) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                      <span className="flex items-center gap-1.5">{config.icon}{config.label}</span>
                      <span className="font-mono text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Departamento</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {departments.map(([dept, count]) => (
                  <button key={dept} onClick={() => toggleSet(selectedDepts, dept, setSelectedDepts)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${selectedDepts.has(dept) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                    <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{dept}</span>
                    <span className="font-mono text-[10px]">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filtered.length} stakeholder{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {stakeholdersError ? (
            <DataError message={stakeholdersError.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <ViewSkeleton />
          ) : filtered.length === 0 ? (
            <div className="glass rounded-lg p-12 text-center">
              <UserX className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Nenhum stakeholder encontrado</p>
              {totalFilters > 0 && <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-1">Limpar filtros</button>}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((s, i) => (
                  <StakeholderCard
                    key={s.id}
                    stakeholder={s}
                    index={i}
                    isExpanded={expandedId === s.id}
                    copiedEmail={copiedEmail}
                    onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onCopyEmail={copyEmail}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Stakeholder</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden md:table-cell">Cargo</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden lg:table-cell">Departamento</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Senioridade</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Score</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden sm:table-cell">Contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((s, i) => (
                    <StakeholderListRow key={s.id} stakeholder={s} index={i} copiedEmail={copiedEmail} onCopyEmail={copyEmail} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
