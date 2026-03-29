import { Building2, MapPin, Tag, Globe, Mail, Phone, TrendingUp, Radar, Calendar, ExternalLink, X, Briefcase, DollarSign, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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

interface CompanyDetailModalProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockSignals = [
  { type: "Visita ao site", detail: "Visitou pricing 3x", time: "2h atrás", strength: "high" as const },
  { type: "Contratando", detail: "Vaga para Head de Tech", time: "1d atrás", strength: "medium" as const },
  { type: "Engajamento", detail: "Abriu email da campanha", time: "3d atrás", strength: "low" as const },
];

const mockHistory = [
  { action: "Enriquecido via LinkedIn", date: "15 Mar 2025" },
  { action: "Adicionado ao workflow de outreach", date: "12 Mar 2025" },
  { action: "Identificado pelo crawler", date: "10 Mar 2025" },
];

const getScoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  if (score >= 60) return "text-warning";
  return "text-destructive";
};

const getScoreBg = (score: number) => {
  if (score >= 90) return "bg-success/10 border-success/30";
  if (score >= 75) return "bg-primary/10 border-primary/30";
  if (score >= 60) return "bg-warning/10 border-warning/30";
  return "bg-destructive/10 border-destructive/30";
};

const strengthColors = {
  high: "bg-success/20 text-success",
  medium: "bg-primary/20 text-primary",
  low: "bg-muted text-muted-foreground",
};

export const CompanyDetailModal = ({ company, open, onOpenChange }: CompanyDetailModalProps) => {
  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border/50 p-0 gap-0">
        {/* Header */}
        <div className="p-6 pb-4">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-foreground">{company.name}</DialogTitle>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1 bg-secondary/50">
                    <Tag className="h-3 w-3" />{company.sector}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{company.location}
                  </span>
                </div>
              </div>
              <div className={`h-14 w-14 rounded-xl border flex items-center justify-center font-mono font-bold text-xl ${getScoreColor(company.ipcScore)} ${getScoreBg(company.ipcScore)}`}>
                {company.ipcScore}
              </div>
            </div>
          </DialogHeader>
        </div>

        <Separator className="bg-border/30" />

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Company info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-lg p-3 space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Funcionários</span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary/70" />{company.employees}
              </p>
            </div>
            <div className="glass rounded-lg p-3 space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Faturamento</span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary/70" />{company.revenue}
              </p>
            </div>
            {company.email && (
              <div className="glass rounded-lg p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary/70" />{company.email}
                </p>
              </div>
            )}
            {company.phone && (
              <div className="glass rounded-lg p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Telefone</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary/70" />{company.phone}
                </p>
              </div>
            )}
          </div>

          {/* Intent signals */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5" />Sinais de Intenção
            </h4>
            <div className="space-y-2">
              {mockSignals.map((signal, i) => (
                <div key={i} className="glass rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{signal.detail}</p>
                    <p className="text-[10px] text-muted-foreground">{signal.type} — {signal.time}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${strengthColors[signal.strength]}`}>
                    {signal.strength === "high" ? "🔥 Alta" : signal.strength === "medium" ? "Média" : "Baixa"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />Histórico
            </h4>
            <div className="space-y-2">
              {mockHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary/50 flex-shrink-0" />
                  <span className="text-foreground">{entry.action}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{entry.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Actions */}
        <div className="p-4 flex gap-2 flex-wrap">
          <Button size="sm" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" />Enviar Email
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" />Adicionar ao CRM
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />Enriquecer
          </Button>
          {company.website && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs ml-auto">
              <ExternalLink className="h-3.5 w-3.5" />Visitar Site
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
