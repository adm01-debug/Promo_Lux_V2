import { useState } from "react";
import { Building2, ExternalLink, MapPin, Tag, Search, SlidersHorizontal, Download, Star, Eye, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyDetailModal } from "@/components/lux/CompanyDetailModal";
import { motion } from "framer-motion";

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

export const CompaniesView = () => {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = mockCompanies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.sector.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase());
    const matchSector = sectorFilter === "all" || c.sector === sectorFilter;
    const matchScore = scoreFilter === "all" ||
      (scoreFilter === "90+" && c.ipcScore >= 90) ||
      (scoreFilter === "75-89" && c.ipcScore >= 75 && c.ipcScore < 90) ||
      (scoreFilter === "60-74" && c.ipcScore >= 60 && c.ipcScore < 75) ||
      (scoreFilter === "<60" && c.ipcScore < 60);
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "enriched" && c.enriched) ||
      (statusFilter === "pending" && !c.enriched);
    const matchSource = sourceFilter === "all" || c.source === sourceFilter;
    return matchSearch && matchSector && matchScore && matchStatus && matchSource;
  });

  const sectors = [...new Set(mockCompanies.map(c => c.sector))];
  const sources = [...new Set(mockCompanies.map(c => c.source))];
  const activeFilters = [sectorFilter, scoreFilter, statusFilter, sourceFilter].filter(f => f !== "all").length;

  const clearFilters = () => {
    setSectorFilter("all");
    setScoreFilter("all");
    setStatusFilter("all");
    setSourceFilter("all");
    setSearch("");
  };

  const openCompany = (company: Company) => {
    setSelectedCompany(company);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Empresas Identificadas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {mockCompanies.length} empresas — {mockCompanies.filter(c => c.enriched).length} enriquecidas
          </p>
        </div>
        <Button variant="outline" className="gap-2 text-sm">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground uppercase tracking-wider">Filtros</span>
          {activeFilters > 0 && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{activeFilters} ativo{activeFilters > 1 ? "s" : ""}</Badge>
          )}
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, setor ou cidade..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos scores</SelectItem>
              <SelectItem value="90+">90+ (Excelente)</SelectItem>
              <SelectItem value="75-89">75-89 (Bom)</SelectItem>
              <SelectItem value="60-74">60-74 (Médio)</SelectItem>
              <SelectItem value="<60">{"<60 (Baixo)"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="enriched">Enriquecido</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas fontes</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden xl:table-cell">Funcionários</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium hidden xl:table-cell">Faturamento</th>
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
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                  onClick={() => openCompany(company)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Star className={`h-4 w-4 cursor-pointer transition-colors ${company.starred ? "text-primary fill-primary" : "text-muted-foreground/30 hover:text-primary/50"}`} />
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
                  <td className="p-3 text-xs text-muted-foreground font-mono hidden xl:table-cell">{company.employees}</td>
                  <td className="p-3 text-xs text-muted-foreground font-mono hidden xl:table-cell">{company.revenue}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-lg font-mono font-bold text-sm ${getScoreColor(company.ipcScore)} ${getScoreBg(company.ipcScore)}`}>
                      {company.ipcScore}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    {company.enriched ? (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Enriquecido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Pendente</Badge>
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
            <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-1">Limpar filtros</button>
          </div>
        )}
      </div>

      <CompanyDetailModal company={selectedCompany} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};
