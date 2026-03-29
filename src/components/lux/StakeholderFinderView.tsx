import { useState, useMemo } from "react";
import { TableSkeleton } from "@/components/lux/ViewSkeleton";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Search, Filter, Crown, Briefcase, Building2, Mail, Phone,
  Linkedin, ChevronDown, ChevronUp, X, ExternalLink, Star, Zap,
  UserCheck, UserX, Shield, Target, TrendingUp, Eye, Copy, Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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

const getScoreGradient = (score: number) => {
  if (score >= 85) return "from-emerald-500 to-emerald-400";
  if (score >= 70) return "from-primary to-amber-400";
  if (score >= 50) return "from-amber-500 to-orange-400";
  return "from-red-500 to-red-400";
};

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const StakeholderFinderView = () => {
  const [search, setSearch] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [selectedSeniority, setSelectedSeniority] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: stakeholders = [], isLoading } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholders")
        .select("*")
        .order("confidence_score", { ascending: false });
      if (error) throw error;
      return data as Stakeholder[];
    },
  });

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    stakeholders.forEach((s) => {
      const dept = s.department || "Outro";
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [stakeholders]);

  const seniorityGroups = useMemo(() => {
    const map = new Map<string, number>();
    stakeholders.forEach((s) => {
      const sen = s.seniority || "unknown";
      map.set(sen, (map.get(sen) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const pa = seniorityConfig[a[0]]?.priority ?? 99;
      const pb = seniorityConfig[b[0]]?.priority ?? 99;
      return pa - pb;
    });
  }, [stakeholders]);

  const filtered = useMemo(() => {
    return stakeholders.filter((s) => {
      const matchSearch =
        !search ||
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.role && s.role.toLowerCase().includes(search.toLowerCase())) ||
        (s.department && s.department.toLowerCase().includes(search.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
      const matchDept = selectedDepts.size === 0 || selectedDepts.has(s.department || "Outro");
      const matchSen = selectedSeniority.size === 0 || selectedSeniority.has(s.seniority || "unknown");
      return matchSearch && matchDept && matchSen;
    });
  }, [stakeholders, search, selectedDepts, selectedSeniority]);

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast({ title: "Email copiado!", description: email });
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const clearFilters = () => {
    setSelectedDepts(new Set());
    setSelectedSeniority(new Set());
    setSearch("");
  };

  const totalFilters = selectedDepts.size + selectedSeniority.size;

  // Stats
  const decisores = stakeholders.filter((s) => ["c-level", "vp", "director"].includes(s.seniority || "")).length;
  const comEmail = stakeholders.filter((s) => s.email).length;
  const comLinkedin = stakeholders.filter((s) => s.linkedin_url).length;
  const avgScore = stakeholders.length > 0
    ? Math.round(stakeholders.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / stakeholders.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Stakeholder Finder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Descubra decisores e influenciadores — {stakeholders.length} stakeholders mapeados
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Decisores", value: decisores, sub: "C-Level + VP + Dir", color: "text-primary", icon: <Crown className="h-4 w-4 text-primary" /> },
          { label: "Com Email", value: comEmail, sub: `${Math.round((comEmail / Math.max(stakeholders.length, 1)) * 100)}% cobertura`, color: "text-success", icon: <Mail className="h-4 w-4 text-success" /> },
          { label: "Com LinkedIn", value: comLinkedin, sub: `${Math.round((comLinkedin / Math.max(stakeholders.length, 1)) * 100)}% perfis`, color: "text-blue-400", icon: <Linkedin className="h-4 w-4 text-blue-400" /> },
          { label: "Score Médio", value: avgScore, sub: "Confiança de dados", color: "text-primary", icon: <Zap className="h-4 w-4 text-primary" /> },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-4 group hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
              {stat.icon}
            </div>
            <p className={`text-2xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Filter sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass rounded-lg p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" /> Filtros
              </span>
              {totalFilters > 0 && (
                <button onClick={clearFilters} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <X className="h-3 w-3" /> Limpar ({totalFilters})
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Nome, cargo, email..."
                className="pl-8 h-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Seniority */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Senioridade</p>
              <div className="space-y-1">
                {seniorityGroups.map(([key, count]) => {
                  const config = getSeniority(key);
                  const isSelected = selectedSeniority.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSet(selectedSeniority, key, setSelectedSeniority)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                        isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {config.icon}
                        {config.label}
                      </span>
                      <span className="font-mono text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Departments */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Departamento</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {departments.map(([dept, count]) => {
                  const isSelected = selectedDepts.has(dept);
                  return (
                    <button
                      key={dept}
                      onClick={() => toggleSet(selectedDepts, dept, setSelectedDepts)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                        isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {dept}
                      </span>
                      <span className="font-mono text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-3">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} stakeholder{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="glass rounded-lg p-12 text-center">
              <UserX className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Nenhum stakeholder encontrado</p>
              {totalFilters > 0 && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-1">
                  Limpar filtros
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((s, i) => {
                  const sen = getSeniority(s.seniority);
                  const score = s.confidence_score || 0;
                  return (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      className="glass rounded-xl p-4 hover:border-primary/30 transition-all group cursor-pointer relative overflow-hidden"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      {/* Score bar at top */}
                      <div className="absolute top-0 left-0 right-0 h-0.5">
                        <div
                          className={`h-full bg-gradient-to-r ${getScoreGradient(score)} transition-all`}
                          style={{ width: `${score}%` }}
                        />
                      </div>

                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center text-sm font-bold text-background shadow-lg`}>
                            {getInitials(s.full_name)}
                          </div>
                          {score >= 85 && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                              <Star className="h-2.5 w-2.5 text-primary-foreground fill-primary-foreground" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-foreground truncate">{s.full_name}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{s.role || "Cargo desconhecido"}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-[9px] gap-0.5 py-0 ${sen.color}`}>
                              {sen.icon} {sen.label}
                            </Badge>
                            {s.department && (
                              <Badge variant="outline" className="text-[9px] bg-secondary/50 py-0">
                                {s.department}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Score circle */}
                        <div className="flex-shrink-0 text-center">
                          <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                            score >= 85 ? "border-emerald-500/50 text-emerald-400" :
                            score >= 70 ? "border-primary/50 text-primary" :
                            score >= 50 ? "border-amber-500/50 text-amber-400" :
                            "border-red-500/50 text-red-400"
                          }`}>
                            {score}
                          </div>
                        </div>
                      </div>

                      {/* Contact row */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                        {s.email && (
                          <button
                            onClick={(e) => { e.stopPropagation(); copyEmail(s.email!); }}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors group/email"
                          >
                            {copiedEmail === s.email ? <Check className="h-3 w-3 text-success" /> : <Mail className="h-3 w-3" />}
                            <span className="truncate max-w-[120px]">{s.email}</span>
                          </button>
                        )}
                        {s.linkedin_url && (
                          <a
                            href={s.linkedin_url}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors ml-auto"
                          >
                            <Linkedin className="h-3 w-3" /> LinkedIn
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {!s.email && !s.linkedin_url && (
                          <span className="text-[10px] text-muted-foreground/50 italic">Sem dados de contato</span>
                        )}
                      </div>

                      {/* Tags */}
                      {s.tags && s.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.tags.map((tag, ti) => (
                            <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 border border-primary/10">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            /* List view */
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
                  {filtered.map((s, i) => {
                    const sen = getSeniority(s.seniority);
                    const score = s.confidence_score || 0;
                    return (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-secondary/20 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center text-[10px] font-bold text-background flex-shrink-0`}>
                              {getInitials(s.full_name)}
                            </div>
                            <div>
                              <span className="font-medium text-foreground text-sm">{s.full_name}</span>
                              {s.tags && s.tags.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {s.tags.slice(0, 2).map((tag, ti) => (
                                    <span key={ti} className="text-[8px] text-primary/60">#{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{s.role || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">{s.department || "—"}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={`text-[9px] gap-0.5 ${sen.color}`}>
                            {sen.icon} {sen.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-mono font-bold text-sm ${
                            score >= 85 ? "text-emerald-400" : score >= 70 ? "text-primary" : score >= 50 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {score}
                          </span>
                        </td>
                        <td className="p-3 text-center hidden sm:table-cell">
                          <div className="flex items-center justify-center gap-1.5">
                            {s.email && (
                              <button
                                onClick={() => copyEmail(s.email!)}
                                className="h-6 w-6 rounded bg-secondary/50 flex items-center justify-center hover:bg-primary/20 transition-colors"
                                title={s.email}
                              >
                                {copiedEmail === s.email ? <Check className="h-3 w-3 text-success" /> : <Mail className="h-3 w-3 text-muted-foreground" />}
                              </button>
                            )}
                            {s.linkedin_url && (
                              <a
                                href={s.linkedin_url}
                                target="_blank"
                                rel="noopener"
                                className="h-6 w-6 rounded bg-secondary/50 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
                              >
                                <Linkedin className="h-3 w-3 text-blue-400" />
                              </a>
                            )}
                            {!s.email && !s.linkedin_url && (
                              <span className="text-[9px] text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
