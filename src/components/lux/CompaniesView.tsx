import { useState, useMemo, useEffect, useCallback } from "react";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_COMPANIES_FULL } from "@/lib/demoData";
import { AddCompanyDialog } from "@/components/lux/AddCompanyDialog";
import { EditCompanyDialog } from "@/components/lux/EditCompanyDialog";
import { Building2, Download, X, Loader2, Trash2, Sparkles, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyDetailModal } from "@/components/lux/CompanyDetailModal";
import { CompanyFilters, CompanyFiltersState, getScoreRange, getCity } from "@/components/lux/CompanyFilters";
import { CompanyPagination } from "@/components/lux/CompanyPagination";
import { EmptyState } from "@/components/lux/EmptyState";
import { ViewSkeleton } from "@/components/lux/ViewSkeleton";
import { DataError } from "@/components/lux/DataError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db, ensureSameOrg, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyTableRow } from "./companies/CompanyTableRow";
import { useCan } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  version: number;
  organization_id?: string | null;
}

export const CompaniesView = () => {
  const { isDemoMode } = useDemo();
  const { toast } = useToast();
  const canDelete = useCan("companies", "delete");
  const canCreate = useCan("companies", "create");
  const [filters, setFilters, resetFilters] = usePersistedFilters<CompanyFiltersState>("companies", {
    search: "", selectedSectors: new Set(), selectedLocations: new Set(),
    selectedSources: new Set(), selectedStatus: new Set(), selectedScores: new Set(),
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "name" | "sector">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const queryClient = useQueryClient();
  const itemsPerPage = 20;

  const { data: rawCompanies, isLoading, error: companiesError, refetch } = useQuery<Company[]>({
    queryKey: ["companies-list"],
    queryFn: isDemoMode
      ? () => DEMO_COMPANIES_FULL as unknown as Company[]
      : async () => {
          const { data, error } = await db.from("companies").select("*").order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []).map((c: any) => ({
            id: c.id, name: c.name, sector: c.sector ?? "—", location: c.location ?? "—",
            ipcScore: c.ipc_score ?? 0, source: c.source, website: c.website ?? undefined,
            employees: c.employees ?? "—", revenue: c.revenue?.toString() ?? "—", email: c.email ?? undefined,
            phone: c.phone ?? undefined, enriched: c.enriched ?? false, starred: c.starred ?? false,
            version: c.version, organization_id: c.organization_id ?? null,
          })) as Company[];
        },
    staleTime: 15_000,
  });

  const companies = rawCompanies ?? [];

  const toggleSet = <T extends string>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  };

  const filtered = useMemo(() => {
    let result = companies.filter((c) => {
      const s = filters.search.toLowerCase();
      const matchSearch = !s || c.name.toLowerCase().includes(s) || c.sector.toLowerCase().includes(s) || c.location.toLowerCase().includes(s) || (c.email && c.email.toLowerCase().includes(s));
      const matchSector = filters.selectedSectors.size === 0 || filters.selectedSectors.has(c.sector);
      const matchLocation = filters.selectedLocations.size === 0 || filters.selectedLocations.has(getCity(c.location));
      const matchSource = filters.selectedSources.size === 0 || filters.selectedSources.has(c.source);
      const matchStatus = filters.selectedStatus.size === 0 || (filters.selectedStatus.has("enriched") && c.enriched) || (filters.selectedStatus.has("pending") && !c.enriched);
      const matchScore = filters.selectedScores.size === 0 || filters.selectedScores.has(getScoreRange(c.ipcScore));
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
  }, [companies, filters, sortBy, sortDir]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  const totalActiveFilters = filters.selectedSectors.size + filters.selectedLocations.size + filters.selectedSources.size + filters.selectedStatus.size + filters.selectedScores.size;

  const handleExport = useCallback(async () => {
    if (filtered.length === 0) { toast({ title: "Nada para exportar", variant: "destructive" }); return; }
    setIsExporting(true);
    try {
      const { downloadCSV } = await import("@/lib/exportCSV");
      downloadCSV(filtered.map((c) => ({ Nome: c.name, Setor: c.sector, Localização: c.location, "Score IPC": c.ipcScore, Fonte: c.source, Email: c.email ?? "", Telefone: c.phone ?? "", Website: c.website ?? "", Funcionários: c.employees, Receita: c.revenue, Status: c.enriched ? "Enriquecido" : "Pendente", Favorito: c.starred ? "Sim" : "Não" })), `empresas_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Exportação concluída", description: `${filtered.length} empresas exportadas.` });
    } catch { toast({ title: "Erro na exportação", variant: "destructive" }); }
    finally { setIsExporting(false); }
  }, [filtered, toast]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const guardOrg = useCallback((company: Company, action: "editar" | "excluir" | "abrir"): boolean => {
    // Em demo mode os registros não têm organization_id real; libera.
    if (isDemoMode) return true;
    // Se a app ainda não carregou a org ativa, bloqueia por segurança.
    if (!getActiveOrgId()) {
      toast({
        title: "Organização não carregada",
        description: "Aguarde a organização ativa carregar antes de continuar.",
        variant: "destructive",
      });
      return false;
    }
    if (!ensureSameOrg(company)) {
      toast({
        title: "Acesso negado",
        description: `Não é possível ${action} um registro de outra organização.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [isDemoMode, toast]);

  const openCompany = (company: Company) => {
    if (!guardOrg(company, "abrir")) return;
    setSelectedCompany(company);
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    if (!guardOrg(company, "editar")) return;
    setEditCompany(company);
    setEditOpen(true);
  };

  const requestDelete = (company: Company) => {
    if (!guardOrg(company, "excluir")) return;
    setDeleteTarget(company);
  };

  const handleSingleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await db.from("companies").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Empresa removida", description: `"${deleteTarget.name}" foi removida.` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
    finally { setIsDeleting(false); setDeleteTarget(null); }
  }, [deleteTarget, toast, queryClient]);

  const toggleSelectId = (id: string) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleSelectAll = () => { if (selectedIds.size === paginatedItems.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedItems.map((c) => c.id))); };

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await db.from("companies").delete().in("id", Array.from(selectedIds));
      if (error) throw error;
      toast({ title: "Empresas removidas", description: `${selectedIds.size} removida(s).` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
    finally { setIsBulkDeleting(false); }
  }, [selectedIds, toast, queryClient]);

  const handleBulkEnrich = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkEnriching(true);
    try {
      const { error } = await db.from("companies").update({ enriched: true }).in("id", Array.from(selectedIds));
      if (error) throw error;
      toast({ title: "Empresas enriquecidas", description: `${selectedIds.size} enriquecida(s).` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
    } catch { toast({ title: "Erro ao enriquecer", variant: "destructive" }); }
    finally { setIsBulkEnriching(false); }
  }, [selectedIds, toast, queryClient]);

  const handleToggleStar = useCallback(async (id: string, starred: boolean) => {
    const company = companies.find((c) => c.id === id);
    if (!company) return;
    queryClient.setQueryData(["companies-list"], (old: Company[] | undefined) => old?.map((c) => (c.id === id ? { ...c, starred } : c)));
    toast({ title: starred ? "⭐ Empresa favoritada" : "Favorito removido", description: `"${company.name}"` });
    const { error } = await db.from("companies").update({ starred, version: company.version }).eq("id", id);
    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("0 rows")) {
        toast({ title: "Conflito detectado", description: "O registro foi alterado por outro usuário. Recarregando...", variant: "destructive" });
      } else {
        toast({ title: "Erro ao favoritar", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
    }
  }, [companies, queryClient, toast]);

  const activeFilterChips: { label: string; onRemove: () => void }[] = [];
  filters.selectedSectors.forEach((v) => activeFilterChips.push({ label: v, onRemove: () => setFilters((f) => ({ ...f, selectedSectors: toggleSet(f.selectedSectors, v) })) }));
  filters.selectedLocations.forEach((v) => activeFilterChips.push({ label: v, onRemove: () => setFilters((f) => ({ ...f, selectedLocations: toggleSet(f.selectedLocations, v) })) }));
  filters.selectedSources.forEach((v) => activeFilterChips.push({ label: `Fonte: ${v}`, onRemove: () => setFilters((f) => ({ ...f, selectedSources: toggleSet(f.selectedSources, v) })) }));
  filters.selectedStatus.forEach((v) => activeFilterChips.push({ label: v === "enriched" ? "Enriquecido" : "Pendente", onRemove: () => setFilters((f) => ({ ...f, selectedStatus: toggleSet(f.selectedStatus, v) })) }));
  filters.selectedScores.forEach((v) => activeFilterChips.push({ label: `Score ${v}`, onRemove: () => setFilters((f) => ({ ...f, selectedScores: toggleSet(f.selectedScores, v) })) }));

  if (isLoading) return <ViewSkeleton />;
  if (companiesError) return <DataError message={companiesError.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Empresas Identificadas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {companies.length} empresas
            {totalActiveFilters > 0 && ` — ${totalActiveFilters} filtro${totalActiveFilters > 1 ? "s" : ""} ativo${totalActiveFilters > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.size} selecionada(s)</span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleBulkEnrich} disabled={isBulkEnriching}>
                {isBulkEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Enriquecer
              </Button>
              {canDelete && (
                <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                  {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remover
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
            </>
          )}
          <Button variant="outline" className="gap-2 text-sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </Button>
          {canCreate && <AddCompanyDialog />}
        </div>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        <CompanyFilters
          filters={filters}
          onSearchChange={(val) => setFilters((f) => ({ ...f, search: val }))}
          onToggleSector={(v) => setFilters((f) => ({ ...f, selectedSectors: toggleSet(f.selectedSectors, v) }))}
          onToggleLocation={(v) => setFilters((f) => ({ ...f, selectedLocations: toggleSet(f.selectedLocations, v) }))}
          onToggleSource={(v) => setFilters((f) => ({ ...f, selectedSources: toggleSet(f.selectedSources, v) }))}
          onToggleStatus={(v) => setFilters((f) => ({ ...f, selectedStatus: toggleSet(f.selectedStatus, v) }))}
          onToggleScore={(v) => setFilters((f) => ({ ...f, selectedScores: toggleSet(f.selectedScores, v as any) }))}
          onClearAll={resetFilters}
          companies={companies}
        />

        <div className="flex-1 space-y-3">
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilterChips.map((chip, i) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/20 transition-colors" onClick={chip.onRemove}>
                  {chip.label} <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
              <button onClick={resetFilters} className="text-[10px] text-muted-foreground hover:text-foreground px-2">Limpar tudo</button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
            <div className="flex gap-1">
              {(["score", "name", "sector"] as const).map((col) => (
                <button key={col} onClick={() => toggleSort(col)} className={`text-[10px] px-2 py-1 rounded transition-colors ${sortBy === col ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {col === "score" ? "Score" : col === "name" ? "Nome" : "Setor"}
                  {sortBy === col && (sortDir === "desc" ? " ↓" : " ↑")}
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="p-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length} onCheckedChange={toggleSelectAll} className="h-4 w-4" />
                    </th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium w-8"></th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Empresa</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden md:table-cell">Setor</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden lg:table-cell">Localização</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden xl:table-cell">Fonte</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center gap-1 cursor-help">Score <HelpCircle className="h-3 w-3 text-muted-foreground/50" /></span></TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs"><p className="font-semibold mb-1">Score IPC</p><p className="text-muted-foreground">90+ Excelente · 75-89 Bom · 60-74 Médio · &lt;60 Baixo.</p></TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden sm:table-cell">Status</th>
                    <th className="text-right p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {paginatedItems.map((company, i) => (
                    <CompanyTableRow
                      key={company.id}
                      company={company}
                      index={i}
                      isSelected={selectedIds.has(company.id)}
                      searchQuery={filters.search}
                      onSelect={() => toggleSelectId(company.id)}
                      onToggleStar={handleToggleStar}
                      onOpen={openCompany}
                      onEdit={openEdit}
                      onDelete={requestDelete}
                      canDelete={canDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <EmptyState icon={Building2} title="Nenhuma empresa encontrada" description="Tente ajustar os filtros." actionLabel="Limpar filtros" onAction={resetFilters} />
            )}

            {filtered.length > 0 && (
              <CompanyPagination currentPage={safePage} totalPages={totalPages} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
            )}
          </div>
        </div>
      </div>

      <CompanyDetailModal company={selectedCompany} open={modalOpen} onOpenChange={setModalOpen} />
      <EditCompanyDialog company={editCompany} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir <strong>"{deleteTarget?.name}"</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSingleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
