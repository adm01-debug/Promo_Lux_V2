import { useState } from "react";
import {
  Building2, MapPin, Tag, Globe, Mail, Phone, TrendingUp, Radar, ExternalLink,
  Briefcase, DollarSign, Users, Star, Copy, Check, Send,
  Eye, Clock, Zap, Database, User, Shield
} from "lucide-react";
import { LinkedinIcon as Linkedin } from "@/components/lux/icons/LinkedinIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

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
  { type: "Visita ao site", detail: "Visitou página de pricing 3x", time: "2h atrás", strength: "high" as const, icon: <Eye className="h-3.5 w-3.5" /> },
  { type: "Contratando", detail: "Vaga aberta: Head de Tecnologia", time: "1d atrás", strength: "high" as const, icon: <Briefcase className="h-3.5 w-3.5" /> },
  { type: "Rodada de investimento", detail: "Série A — R$ 15M captados", time: "3d atrás", strength: "high" as const, icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { type: "Engajamento", detail: "Abriu email da campanha de outreach", time: "5d atrás", strength: "medium" as const, icon: <Mail className="h-3.5 w-3.5" /> },
  { type: "Adoção de tech", detail: "Migrou infra para AWS EKS", time: "1 sem atrás", strength: "low" as const, icon: <Globe className="h-3.5 w-3.5" /> },
];

const mockContacts = [
  { name: "Ana Silva", role: "CEO & Co-founder", email: "ana@company.com", linkedin: true, verified: true },
  { name: "Pedro Santos", role: "CTO", email: "pedro@company.com", linkedin: true, verified: true },
  { name: "Maria Costa", role: "VP of Sales", email: "maria@company.com", linkedin: true, verified: false },
  { name: "Lucas Mendes", role: "Head of Growth", email: "lucas@company.com", linkedin: false, verified: true },
];

const mockTimeline = [
  { action: "Email de follow-up enviado", type: "outreach", date: "28 Mar 2025", detail: "Campanha: SaaS Q1" },
  { action: "Abriu email — Taxa de abertura 3/3", type: "engagement", date: "27 Mar 2025", detail: "Tempo de leitura: 45s" },
  { action: "Email inicial enviado", type: "outreach", date: "25 Mar 2025", detail: "Assunto: Como empresas SaaS estão..." },
  { action: "Enriquecido via waterfall (Hunter + Clearbit)", type: "enrichment", date: "20 Mar 2025", detail: "4 contatos encontrados, 3 emails verificados" },
  { action: "Qualificado pelo IPC — Score 94", type: "qualification", date: "18 Mar 2025", detail: "Critérios: SaaS B2B, SP, 50-200 func." },
  { action: "Adicionado ao workflow de prospecção", type: "workflow", date: "15 Mar 2025", detail: "Workflow: LinkedIn → Enriquecimento → CRM" },
  { action: "Identificado pelo crawler de LinkedIn", type: "discovery", date: "14 Mar 2025", detail: "Fonte: LinkedIn Sales Navigator" },
];

const mockTechnologies = ["React", "Node.js", "AWS", "PostgreSQL", "Kubernetes", "Stripe", "HubSpot"];

const timelineIcons: Record<string, React.ReactNode> = {
  outreach: <Send className="h-3 w-3" />,
  engagement: <Eye className="h-3 w-3" />,
  enrichment: <Database className="h-3 w-3" />,
  qualification: <Star className="h-3 w-3" />,
  workflow: <Zap className="h-3 w-3" />,
  discovery: <Radar className="h-3 w-3" />,
};

const timelineColors: Record<string, string> = {
  outreach: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  engagement: "bg-green-500/20 text-green-400 border-green-500/30",
  enrichment: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  qualification: "bg-primary/20 text-primary border-primary/30",
  workflow: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  discovery: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

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
  high: "bg-success/20 text-success border-success/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="text-muted-foreground/50 hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

export const CompanyDetailModal = ({ company, open, onOpenChange }: CompanyDetailModalProps) => {
  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border/50 p-0 gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold text-foreground">{company.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1 bg-secondary/50">
                    <Tag className="h-3 w-3" />{company.sector}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{company.location}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-secondary/50">{company.source}</Badge>
                  {company.enriched ? (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Enriquecido</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Pendente</Badge>
                  )}
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                <div className={`h-14 w-14 rounded-xl border flex items-center justify-center font-mono font-bold text-xl ${getScoreColor(company.ipcScore)} ${getScoreBg(company.ipcScore)}`}>
                  {company.ipcScore}
                </div>
                <span className="text-[9px] text-muted-foreground mt-1 block">Score IPC</span>
              </div>
            </div>
          </DialogHeader>

          {/* Quick info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="glass rounded-lg p-2.5 space-y-0.5">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Funcionários</span>
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-primary/70" />{company.employees}
              </p>
            </div>
            <div className="glass rounded-lg p-2.5 space-y-0.5">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Faturamento</span>
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-primary/70" />{company.revenue}
              </p>
            </div>
            {company.email && (
              <div className="glass rounded-lg p-2.5 space-y-0.5">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Email</span>
                <p className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3 text-primary/70" />
                  <span className="truncate">{company.email}</span>
                  <CopyButton text={company.email} />
                </p>
              </div>
            )}
            {company.phone && (
              <div className="glass rounded-lg p-2.5 space-y-0.5">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Telefone</span>
                <p className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3 text-primary/70" />{company.phone}
                  <CopyButton text={company.phone} />
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-border/30 flex-shrink-0" />

        {/* Tabbed content */}
        <Tabs defaultValue="signals" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-transparent px-6 h-10 flex-shrink-0">
            <TabsTrigger value="signals" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md gap-1.5">
              <Radar className="h-3 w-3" /> Sinais ({mockSignals.length})
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md gap-1.5">
              <User className="h-3 w-3" /> Contatos ({mockContacts.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md gap-1.5">
              <Clock className="h-3 w-3" /> Timeline ({mockTimeline.length})
            </TabsTrigger>
            <TabsTrigger value="tech" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md gap-1.5">
              <Globe className="h-3 w-3" /> Tech Stack
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Signals Tab */}
            <TabsContent value="signals" className="p-5 space-y-2 mt-0">
              {mockSignals.map((signal, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-lg p-3 flex items-center gap-3"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${strengthColors[signal.strength]}`}>
                    {signal.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{signal.detail}</p>
                    <p className="text-[10px] text-muted-foreground">{signal.type} — {signal.time}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${strengthColors[signal.strength]}`}>
                    {signal.strength === "high" ? "🔥 Alta" : signal.strength === "medium" ? "Média" : "Baixa"}
                  </Badge>
                </motion.div>
              ))}
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="p-5 space-y-2 mt-0">
              {mockContacts.map((contact, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {contact.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      {contact.linkedin && (
                        <Linkedin className="h-3 w-3 text-blue-400" />
                      )}
                      {contact.verified && (
                        <Shield className="h-3 w-3 text-success" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{contact.role}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[11px] text-foreground/80 font-mono">{contact.email}</p>
                      <CopyButton text={contact.email} />
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Enviar email">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    {contact.linkedin && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver LinkedIn">
                        <Linkedin className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
              <div className="pt-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs w-full">
                  <Database className="h-3.5 w-3.5" /> Buscar mais contatos via waterfall
                </Button>
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="p-5 mt-0">
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/30" />
                <div className="space-y-4">
                  {mockTimeline.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex gap-3 relative"
                    >
                      <div className={`h-[30px] w-[30px] rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${timelineColors[entry.type]}`}>
                        {timelineIcons[entry.type]}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium text-foreground leading-tight">{entry.action}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.detail}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{entry.date}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tech Stack Tab */}
            <TabsContent value="tech" className="p-5 space-y-4 mt-0">
              <div>
                <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Tecnologias Detectadas</h4>
                <div className="flex flex-wrap gap-2">
                  {mockTechnologies.map((tech) => (
                    <Badge key={tech} variant="outline" className="text-xs bg-secondary/50 gap-1">
                      <Globe className="h-3 w-3 text-primary/70" />{tech}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator className="bg-border/20" />
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Website</span>
                  <p className="text-xs text-primary">{company.website || "N/A"}</p>
                </div>
                <div className="glass rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Fonte dos dados</span>
                  <p className="text-xs text-foreground">{company.source}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <Separator className="bg-border/30 flex-shrink-0" />

        {/* Actions */}
        <div className="p-4 flex gap-2 flex-wrap flex-shrink-0">
          <Button size="sm" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" />Enviar Email
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Send className="h-3.5 w-3.5" />Iniciar Sequência
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
