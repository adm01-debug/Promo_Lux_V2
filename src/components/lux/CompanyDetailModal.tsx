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
import { useCompanyDetails } from "@/hooks/useCompanyDetails";

interface Company {
  id: string;
  name: string;
  cnpj?: string;
  sector: string;
  location: string;
  ipcScore: number;
  source: string;
  website?: string;
  linkedin_url?: string;
  instagram_url?: string;
  employees: string;
  revenue: string;
  email?: string;
  phone?: string;
  description?: string;
  enriched: boolean;
  starred: boolean;
}

interface CompanyDetailModalProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timelineIcons: Record<string, React.ReactNode> = {
  outreach: <Send className="h-3 w-3" />,
  engagement: <Eye className="h-3 w-3" />,
  enrichment: <Database className="h-3 w-3" />,
  qualification: <Star className="h-3 w-3" />,
  workflow: <Zap className="h-3 w-3" />,
  discovery: <Radar className="h-3 w-3" />,
  signal: <Radar className="h-3 w-3" />,
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

const strengthColors: Record<string, string> = {
  high: "bg-success/20 text-success border-success/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

const normalizeStrength = (s: string | null | undefined): "high" | "medium" | "low" => {
  const v = (s ?? "").toLowerCase();
  if (["high", "alta", "forte", "hot"].includes(v)) return "high";
  if (["low", "baixa", "fraca", "cold"].includes(v)) return "low";
  return "medium";
};

const strengthLabel = (s: "high" | "medium" | "low") =>
  s === "high" ? "🔥 Alta" : s === "medium" ? "Média" : "Baixa";

const EmptyTab = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center py-12 text-center">
    <p className="text-xs text-muted-foreground">{text}</p>
  </div>
);


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
  const { data, isLoading } = useCompanyDetails(company?.id, open && !!company);
  if (!company) return null;

  const contacts = data?.contacts ?? [];
  const signals = data?.signals ?? [];
  const timeline = data?.timeline ?? [];
  const technologies = data?.technologies ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border/50 p-0 gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {company.linkedin_url && (
                  <img 
                    src={`https://logo.clearbit.com/${new URL(company.website || "").hostname}`} 
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                )}
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
                  <Badge variant="outline" className="text-[10px] bg-secondary/50 uppercase">{company.source}</Badge>
                  {company.cnpj && (
                    <Badge variant="outline" className="text-[10px] bg-secondary/50 font-mono">CNPJ: {company.cnpj}</Badge>
                  )}
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
          {company.description && (
            <p className="mt-4 text-sm text-muted-foreground line-clamp-2 italic">
              "{company.description}"
            </p>
          )}
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
