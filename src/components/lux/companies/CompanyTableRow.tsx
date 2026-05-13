import { Building2, MapPin, Tag, Star, Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  version: number;
}

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

export const HighlightText = ({ text, query }: { text: string; query: string }) => {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
};

interface CompanyTableRowProps {
  company: Company;
  index: number;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
  onOpen: (company: Company) => void;
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const CompanyTableRow = ({ company, index, isSelected, searchQuery, onSelect, onToggleStar, onOpen, onEdit, onDelete, canEdit = true, canDelete = true }: CompanyTableRowProps) => (
  <motion.tr
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.02 }}
    className={`hover:bg-secondary/20 transition-colors group cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
    onClick={() => onOpen(company)}
  >
    <td className="p-3" onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-4 w-4" />
    </td>
    <td className="p-3" onClick={(e) => { e.stopPropagation(); onToggleStar(company.id, !company.starred); }}>
      <Star className={`h-4 w-4 cursor-pointer transition-all duration-200 hover:scale-125 ${company.starred ? "text-primary fill-primary" : "text-muted-foreground/30 hover:text-primary/50"}`} />
    </td>
    <td className="p-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="font-medium text-foreground"><HighlightText text={company.name} query={searchQuery} /></span>
          {company.email && <p className="text-[10px] text-muted-foreground"><HighlightText text={company.email} query={searchQuery} /></p>}
        </div>
      </div>
    </td>
    <td className="p-3 hidden md:table-cell">
      <Badge variant="outline" className="text-xs gap-1 bg-secondary/50"><Tag className="h-3 w-3" /><HighlightText text={company.sector} query={searchQuery} /></Badge>
    </td>
    <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /><HighlightText text={company.location} query={searchQuery} /></span>
    </td>
    <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">{company.source}</td>
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
    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
      <div className="hidden sm:flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalhes">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => onEdit(company)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => onDelete(company)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(company)}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(company)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(company)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </td>
  </motion.tr>
);
