import { useState, useMemo } from "react";
import { Building2, MapPin, Tag, Search, Download, Star, Eye, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyDetailModal } from "@/components/lux/CompanyDetailModal";
import { motion, AnimatePresence } from "framer-motion";

interface Company {
  id: string;
  name: string;
  sector: string;
  location: string;
  ipcScore: number;
  source: string;
  website?: string;
  employees: string;
  revenue: string;
  email?: string;
  phone?: string;
  enriched: boolean;
  starred: boolean;
}

const mockCompanies: Company[] = [
  { id: "1", name: "TechNova Solutions", sector: "SaaS B2B", location: "São Paulo, SP", ipcScore: 94, source: "LinkedIn", website: "#", employees: "50-200", revenue: "R$ 5M-20M", email: "contato@technova.com", phone: "+55 11 9999-0001", enriched: true, starred: true },
  { id: "2", name: "DataFlow Analytics", sector: "Big Data", location: "Campinas, SP", ipcScore: 88, source: "Google Maps", employees: "20-50", revenue: "R$ 2M-5M", email: "info@dataflow.io", enriched: true, starred: false },
  { id: "3", name: "CloudBridge Inc", sector: "Cloud", location: "Rio de Janeiro, RJ", ipcScore: 85, source: "Crawler", employees: "100-500", revenue: "R$ 10M-50M", enriched: true, starred: true },
  { id: "4", name: "AgriSmart Tech", sector: "AgTech", location: "Ribeirão Preto, SP", ipcScore: 79, source: "CNPJ API", employees: "10-50", revenue: "R$ 1M-5M", enriched: false, starred: false },
  { id: "5", name: "FinEdge Pay", sector: "Fintech", location: "Belo Horizonte, MG", ipcScore: 76, source: "LinkedIn", employees: "50-200", revenue: "R$ 5M-20M", email: "hello@finedge.com.br", enriched: true, starred: false },
  { id: "6", name: "LogiTrack Systems", sector: "Logística", location: "Curitiba, PR", ipcScore: 72, source: "Google Maps", employees: "200-500", revenue: "R$ 20M-50M", enriched: false, starred: false },
  { id: "7", name: "EduPlatform BR", sector: "EdTech", location: "Florianópolis, SC", ipcScore: 68, source: "Crawler", employees: "10-50", revenue: "R$ 500K-2M", enriched: false, starred: false },
  { id: "8", name: "MedConnect Health", sector: "HealthTech", location: "São Paulo, SP", ipcScore: 91, source: "LinkedIn", employees: "50-200", revenue: "R$ 10M-50M", email: "team@medconnect.com", enriched: true, starred: true },
  { id: "9", name: "PayFlex Brasil", sector: "Fintech", location: "São Paulo, SP", ipcScore: 87, source: "LinkedIn", employees: "100-500", revenue: "R$ 20M-50M", email: "contato@payflex.com", enriched: true, starred: false },
  { id: "10", name: "GreenFarm IoT", sector: "AgTech", location: "Campinas, SP", ipcScore: 74, source: "Google Maps", employees: "10-50", revenue: "R$ 1M-5M", enriched: false, starred: false },
  { id: "11", name: "CodeShip Dev", sector: "SaaS B2B", location: "Florianópolis, SC", ipcScore: 82, source: "Crawler", employees: "20-50", revenue: "R$ 2M-5M", email: "hi@codeship.dev", enriched: true, starred: false },
  { id: "12", name: "VitalCare Plus", sector: "HealthTech", location: "Belo Horizonte, MG", ipcScore: 69, source: "CNPJ API", employees: "50-200", revenue: "R$ 5M-20M", enriched: false, starred: false },
];

const getScoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  if (score >= 60) return "text-warning";
  return "text-destructive";
};

const getScoreBg = (score: number) => {
  if (score >= 90) return "bg-success/10";
  if (score >= 75) return "bg-primary/10";
  if (score >= 60) return "bg-warning/10";
  return "bg-destructive/10";
};

type ScoreRange = "all" | "90+" | "75-89" | "60-74" | "<60";

interface FacetItem {
  value: string;
  label: string;
  count: number;
}

const FacetGroup = ({
  title,
  items,
  selected,
  onToggle,
  icon,
}: {
  title: string;
  items: FacetItem[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  icon?: React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasSelection = selected.size > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
          {hasSelection && (
            <span className="text-[9px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-bold normal-case tracking-normal">
              {selected.size}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-3">
              {items.map((item) => {
                const isSelected = selected.has(item.value);
                return (
                  <button
                    key={item.value}
                    onClick={() => onToggle(item.value)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded border transition-colors flex items-center justify-center ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <span className="text-[8px] text-primary-foreground font-bold">✓</span>}
                      </div>
                      {item.label}
                    </span>
                    <span className={`font-mono text-[10px] ${isSelected ? "text-primary" : "text-muted-foreground/50"}`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CompaniesView = () => {
  const [search, setSearch] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());
  const [selectedScores, setSelectedScores] = useState<Set<ScoreRange>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "name" | "sector">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSet = <T extends string>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const getScoreRange = (score: number): ScoreRange => {
    if (score >= 90) return "90+";
    if (score >= 75) return "75-89";
    if (score >= 60) return "60-74";
    return "<60";
  };

  // Extract location city (before comma)
  const getCity = (location: string) => location.split(",")[0].trim();

  const filtered = useMemo(() => {
    let result = mockCompanies.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.sector.toLowerCase().includes(search.toLowerCase()) ||
        c.location.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
      const matchSector = selectedSectors.size === 0 || selectedSectors.has(c.sector);
      const matchLocation = selectedLocations.size === 0 || selectedLocations.has(getCity(c.location));
      const matchSource = selectedSources.size === 0 || selectedSources.has(c.source);
      const matchStatus =
        selectedStatus.size === 0 ||
        (selectedStatus.has("enriched") && c.enriched) ||
        (selectedStatus.has("pending") && !c.enriched);
      const matchScore = selectedScores.size === 0 || selectedScores.has(getScoreRange(c.ipcScore));
      return matchSearch && matchSector && matchLocation && matchSource && matchStatus && matchScore;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "score") cmp = a.ipcScore - b.ipcScore;
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "sector") cmp = a.sector.localeCompare(b.sector);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [search, selectedSectors, selectedLocations, selectedSources, selectedStatus, selectedScores, sortBy, sortDir]);

  // Facet counts based on current data (not filtered, so user sees total)
  const sectorFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    mockCompanies.forEach((c) => map.set(c.sector, (map.get(c.sector) || 0) + 1));
    return Array.from(map.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const locationFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    mockCompanies.forEach((c) => {
      const city = getCity(c.location);
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const sourceFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    mockCompanies.forEach((c) => map.set(c.source, (map.get(c.source) || 0) + 1));
    return Array.from(map.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const statusFacets: FacetItem[] = useMemo(() => {
    const enriched = mockCompanies.filter((c) => c.enriched).length;
    return [
      { value: "enriched", label: "Enriquecido", count: enriched },
      { value: "pending", label: "Pendente", count: mockCompanies.length - enriched },
    ];
  }, []);

  const scoreFacets: FacetItem[] = useMemo(() => {
    const ranges: { value: ScoreRange; label: string }[] = [
      { value: "90+", label: "90+ Excelente" },
      { value: "75-89", label: "75-89 Bom" },
      { value: "60-74", label: "60-74 Médio" },
      { value: "<60", label: "<60 Baixo" },
    ];
    return ranges.map((r) => ({
      ...r,
      count: mockCompanies.filter((c) => getScoreRange(c.ipcScore) === r.value).length,
    }));
  }, []);

  const totalActiveFilters =
    selectedSectors.size + selectedLocations.size + selectedSources.size + selectedStatus.size + selectedScores.size;

  const clearAllFilters = () => {
    setSelectedSectors(new Set());
    setSelectedLocations(new Set());
    setSelectedSources(new Set());
    setSelectedStatus(new Set());
    setSelectedScores(new Set());
    setSearch("");
  };

  const activeFilterChips: { label: string; onRemove: () => void }[] = [];
  selectedSectors.forEach((v) =>
    activeFilterChips.push({ label: v, onRemove: () => toggleSet(selectedSectors, v, setSelectedSectors) })
  );
  selectedLocations.forEach((v) =>
    activeFilterChips.push({ label: v, onRemove: () => toggleSet(selectedLocations, v, setSelectedLocations) })
  );
  selectedSources.forEach((v) =>
    activeFilterChips.push({ label: `Fonte: ${v}`, onRemove: () => toggleSet(selectedSources, v, setSelectedSources) })
  );
  selectedStatus.forEach((v) =>
    activeFilterChips.push({
      label: v === "enriched" ? "Enriquecido" : "Pendente",
      onRemove: () => toggleSet(selectedStatus, v, setSelectedStatus),
    })
  );
  selectedScores.forEach((v) =>
    activeFilterChips.push({ label: `Score ${v}`, onRemove: () => toggleSet(selectedScores, v, setSelectedScores) })
  );

  const openCompany = (company: Company) => {
    setSelectedCompany(company);
    setModalOpen(true);
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Empresas Identificadas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {mockCompanies.length} empresas
            {totalActiveFilters > 0 && ` — ${totalActiveFilters} filtro${totalActiveFilters > 1 ? "s" : ""} ativo${totalActiveFilters > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="outline" className="gap-2 text-sm">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Faceted sidebar */}
        <div className="lg:w-60 flex-shrink-0">
          <div className="glass rounded-lg p-4 space-y-1 sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" /> Filtros
              </span>
              {totalActiveFilters > 0 && (
                <button onClick={clearAllFilters} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <X className="h-3 w-3" /> Limpar ({totalActiveFilters})
                </button>
              )}
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-8 h-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="divide-y divide-border/20">
              <FacetGroup
                title="Setor"
                icon={<Tag className="h-3 w-3" />}
                items={sectorFacets}
                selected={selectedSectors}
                onToggle={(v) => toggleSet(selectedSectors, v, setSelectedSectors)}
              />
              <FacetGroup
                title="Score IPC"
                items={scoreFacets}
                selected={selectedScores as Set<string>}
                onToggle={(v) => toggleSet(selectedScores, v as ScoreRange, setSelectedScores)}
              />
              <FacetGroup
                title="Localização"
                icon={<MapPin className="h-3 w-3" />}
                items={locationFacets}
                selected={selectedLocations}
                onToggle={(v) => toggleSet(selectedLocations, v, setSelectedLocations)}
              />
              <FacetGroup
                title="Status"
                items={statusFacets}
                selected={selectedStatus}
                onToggle={(v) => toggleSet(selectedStatus, v, setSelectedStatus)}
              />
              <FacetGroup
                title="Fonte"
                items={sourceFacets}
                selected={selectedSources}
                onToggle={(v) => toggleSet(selectedSources, v, setSelectedSources)}
              />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-3">
          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilterChips.map((chip, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={chip.onRemove}
                >
                  {chip.label}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
              <button onClick={clearAllFilters} className="text-[10px] text-muted-foreground hover:text-foreground px-2">
                Limpar tudo
              </button>
            </div>
          )}

          {/* Results summary */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              {(["score", "name", "sector"] as const).map((col) => (
                <button
                  key={col}
                  onClick={() => toggleSort(col)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    sortBy === col ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {col === "score" ? "Score" : col === "name" ? "Nome" : "Setor"}
                  {sortBy === col && (sortDir === "desc" ? " ↓" : " ↑")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium w-8"></th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Empresa</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden md:table-cell">Setor</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden lg:table-cell">Localização</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden xl:table-cell">Fonte</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Score</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden sm:table-cell">Status</th>
                    <th className="text-right p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((company, i) => (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                      onClick={() => openCompany(company)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Star
                          className={`h-4 w-4 cursor-pointer transition-colors ${
                            company.starred ? "text-primary fill-primary" : "text-muted-foreground/30 hover:text-primary/50"
                          }`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{company.name}</span>
                            {company.email && <p className="text-[10px] text-muted-foreground">{company.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-xs gap-1 bg-secondary/50">
                          <Tag className="h-3 w-3" />
                          {company.sector}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.location}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">{company.source}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg font-mono font-bold text-sm ${getScoreColor(
                            company.ipcScore
                          )} ${getScoreBg(company.ipcScore)}`}
                        >
                          {company.ipcScore}
                        </span>
                      </td>
                      <td className="p-3 text-center hidden sm:table-cell">
                        {company.enriched ? (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                            Enriquecido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                            Pendente
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma empresa encontrada com os filtros selecionados</p>
                <button onClick={clearAllFilters} className="text-xs text-primary hover:underline mt-1">
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <CompanyDetailModal company={selectedCompany} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};
