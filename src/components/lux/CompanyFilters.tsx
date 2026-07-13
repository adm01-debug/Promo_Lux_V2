import { useState, useMemo, forwardRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tag, Search, MapPin, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { getScoreRange, getCity, type ScoreRange, type FacetItem } from "./company-filters-utils";


const FacetGroup = forwardRef<HTMLDivElement, {
  title: string;
  items: FacetItem[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  icon?: React.ReactNode;
}>(({ title, items, selected, onToggle, icon }, ref) => {
  const [expanded, setExpanded] = useState(true);
  const hasSelection = selected.size > 0;

  return (
    <div ref={ref}>
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
              {items.map((item, i) => {
                const isSelected = selected.has(item.value);
                return (
                  <motion.button
                    key={item.value}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => onToggle(item.value)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={isSelected ? { scale: [1, 1.2, 1], backgroundColor: "hsl(var(--primary))" } : { scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`h-3 w-3 rounded border transition-colors flex items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <span className="text-[8px] text-primary-foreground font-bold">✓</span>}
                      </motion.div>
                      {item.label}
                    </span>
                    <span className={`font-mono text-[10px] ${isSelected ? "text-primary" : "text-muted-foreground/50"}`}>
                      {item.count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FacetGroup.displayName = "FacetGroup";

export interface CompanyFiltersState {
  search: string;
  selectedSectors: Set<string>;
  selectedLocations: Set<string>;
  selectedSources: Set<string>;
  selectedStatus: Set<string>;
  selectedScores: Set<ScoreRange>;
}

interface CompanyFiltersProps {
  filters: CompanyFiltersState;
  onSearchChange: (val: string) => void;
  onToggleSector: (val: string) => void;
  onToggleLocation: (val: string) => void;
  onToggleSource: (val: string) => void;
  onToggleStatus: (val: string) => void;
  onToggleScore: (val: string) => void;
  onClearAll: () => void;
  companies: { sector: string; location: string; source: string; enriched: boolean; ipcScore: number }[];
}



export const CompanyFilters = ({
  filters,
  onSearchChange,
  onToggleSector,
  onToggleLocation,
  onToggleSource,
  onToggleStatus,
  onToggleScore,
  onClearAll,
  companies,
}: CompanyFiltersProps) => {
  const isMobile = useIsMobile();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const totalActiveFilters =
    filters.selectedSectors.size +
    filters.selectedLocations.size +
    filters.selectedSources.size +
    filters.selectedStatus.size +
    filters.selectedScores.size;

  const sectorFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => map.set(c.sector, (map.get(c.sector) || 0) + 1));
    return Array.from(map.entries()).map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count);
  }, [companies]);

  const locationFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => { const city = getCity(c.location); map.set(city, (map.get(city) || 0) + 1); });
    return Array.from(map.entries()).map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count);
  }, [companies]);

  const sourceFacets: FacetItem[] = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => map.set(c.source, (map.get(c.source) || 0) + 1));
    return Array.from(map.entries()).map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count);
  }, [companies]);

  const statusFacets: FacetItem[] = useMemo(() => {
    const enriched = companies.filter((c) => c.enriched).length;
    return [
      { value: "enriched", label: "Enriquecido", count: enriched },
      { value: "pending", label: "Pendente", count: companies.length - enriched },
    ];
  }, [companies]);

  const scoreFacets: FacetItem[] = useMemo(() => {
    const ranges: { value: ScoreRange; label: string }[] = [
      { value: "90+", label: "90+ Excelente" },
      { value: "75-89", label: "75-89 Bom" },
      { value: "60-74", label: "60-74 Médio" },
      { value: "<60", label: "<60 Baixo" },
    ];
    return ranges.map((r) => ({
      ...r,
      count: companies.filter((c) => getScoreRange(c.ipcScore) === r.value).length,
    }));
  }, [companies]);

  const filterContent = (
    <>
      <div className="relative mb-3 group">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
        <Input
          placeholder="Buscar empresas..."
          className="pl-8 h-8 text-xs transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:shadow-[0_0_12px_hsl(var(--primary)/0.1)]"
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {filters.search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors"
          >
            <X className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="divide-y divide-border/20">
        <FacetGroup title="Setor" icon={<Tag className="h-3 w-3" />} items={sectorFacets} selected={filters.selectedSectors} onToggle={onToggleSector} />
        <FacetGroup title="Score IPC" items={scoreFacets} selected={filters.selectedScores as Set<string>} onToggle={onToggleScore} />
        <FacetGroup title="Localização" icon={<MapPin className="h-3 w-3" />} items={locationFacets} selected={filters.selectedLocations} onToggle={onToggleLocation} />
        <FacetGroup title="Status" items={statusFacets} selected={filters.selectedStatus} onToggle={onToggleStatus} />
        <FacetGroup title="Fonte" items={sourceFacets} selected={filters.selectedSources} onToggle={onToggleSource} />
      </div>
    </>
  );

  return (
    <div className="lg:w-60 flex-shrink-0">
      <div className="glass rounded-lg p-4 space-y-1 sticky top-20">
        <div className="flex items-center justify-between mb-3">
          <button
            className="text-xs font-semibold text-foreground flex items-center gap-1.5 lg:cursor-default"
            onClick={() => isMobile && setMobileExpanded(!mobileExpanded)}
          >
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros
            {totalActiveFilters > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-bold">
                {totalActiveFilters}
              </span>
            )}
            {isMobile && (
              mobileExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {totalActiveFilters > 0 && (
            <button onClick={onClearAll} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              <X className="h-3 w-3" /> Limpar ({totalActiveFilters})
            </button>
          )}
        </div>

        {/* Desktop: always show. Mobile: collapsible */}
        <div className="hidden lg:block">
          {filterContent}
        </div>
        <AnimatePresence>
          {isMobile && mobileExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden lg:hidden"
            >
              {filterContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export { getScoreRange, getCity };
export type { ScoreRange, FacetItem };
