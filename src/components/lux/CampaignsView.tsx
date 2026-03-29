import { useState } from "react";
import { Mail, Plus, Play, Pause, BarChart3, Users, Clock, Send, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type CampaignStatus = "active" | "paused" | "draft" | "completed";

interface SequenceStep {
  id: string;
  type: "email" | "linkedin" | "wait";
  label: string;
  sent?: number;
  opened?: number;
  replied?: number;
}

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  prospects: number;
  sent: number;
  opened: number;
  replied: number;
  meetings: number;
  sequence: SequenceStep[];
  startDate: string;
}

const statusConfig: Record<CampaignStatus, { label: string; color: string }> = {
  active: { label: "Ativa", color: "bg-success/20 text-success border-success/30" },
  paused: { label: "Pausada", color: "bg-warning/20 text-warning border-warning/30" },
  draft: { label: "Rascunho", color: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30" },
  completed: { label: "Concluída", color: "bg-primary/20 text-primary border-primary/30" },
};

const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Outbound SaaS B2B — Q1 2025",
    status: "active",
    prospects: 450,
    sent: 380,
    opened: 228,
    replied: 45,
    meetings: 12,
    startDate: "15 Jan 2025",
    sequence: [
      { id: "s1", type: "email", label: "Email Inicial", sent: 380, opened: 228, replied: 22 },
      { id: "s2", type: "wait", label: "Esperar 3 dias" },
      { id: "s3", type: "email", label: "Follow-up 1", sent: 310, opened: 186, replied: 15 },
      { id: "s4", type: "wait", label: "Esperar 5 dias" },
      { id: "s5", type: "linkedin", label: "Conexão LinkedIn", sent: 250, opened: 200, replied: 8 },
      { id: "s6", type: "email", label: "Follow-up Final", sent: 180, opened: 90, replied: 0 },
    ],
  },
  {
    id: "2",
    name: "HealthTech — Decision Makers",
    status: "active",
    prospects: 120,
    sent: 95,
    opened: 71,
    replied: 18,
    meetings: 6,
    startDate: "1 Fev 2025",
    sequence: [
      { id: "s1", type: "email", label: "Email Personalizado", sent: 95, opened: 71, replied: 12 },
      { id: "s2", type: "wait", label: "Esperar 2 dias" },
      { id: "s3", type: "linkedin", label: "InMail", sent: 60, opened: 45, replied: 6 },
    ],
  },
  {
    id: "3",
    name: "Fintech Expansion — Sul do Brasil",
    status: "draft",
    prospects: 200,
    sent: 0,
    opened: 0,
    replied: 0,
    meetings: 0,
    startDate: "—",
    sequence: [
      { id: "s1", type: "email", label: "Introdução" },
      { id: "s2", type: "wait", label: "Esperar 3 dias" },
      { id: "s3", type: "email", label: "Case Study" },
    ],
  },
];

const stepIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />,
  linkedin: <MessageSquare className="h-3 w-3" />,
  wait: <Clock className="h-3 w-3" />,
};

export const CampaignsView = () => {
  const [expandedId, setExpandedId] = useState<string | null>("1");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Campanhas de Outreach
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inspirado em Instantly.ai — sequências multi-canal automatizadas
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Emails Enviados", value: "475", icon: <Send className="h-4 w-4" /> },
          { label: "Taxa de Abertura", value: "60%", icon: <Mail className="h-4 w-4" /> },
          { label: "Taxa de Resposta", value: "11.8%", icon: <MessageSquare className="h-4 w-4" /> },
          { label: "Reuniões Agendadas", value: "18", icon: <CheckCircle2 className="h-4 w-4" /> },
        ].map((s) => (
          <div key={s.label} className="glass rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</span>
              <div className="text-primary/60">{s.icon}</div>
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div className="space-y-4">
        {mockCampaigns.map((camp) => {
          const config = statusConfig[camp.status];
          const isExpanded = expandedId === camp.id;
          const openRate = camp.sent > 0 ? Math.round((camp.opened / camp.sent) * 100) : 0;
          const replyRate = camp.sent > 0 ? Math.round((camp.replied / camp.sent) * 100) : 0;

          return (
            <div key={camp.id} className="glass rounded-lg overflow-hidden">
              <button
                className="w-full p-5 text-left flex items-center justify-between hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : camp.id)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{camp.name}</span>
                    <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><Users className="inline h-3 w-3 mr-1" />{camp.prospects} prospects</span>
                    <span>Início: {camp.startDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Abertura</p>
                    <p className="font-mono font-bold text-foreground">{openRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Resposta</p>
                    <p className="font-mono font-bold text-primary">{replyRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reuniões</p>
                    <p className="font-mono font-bold text-success">{camp.meetings}</p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 p-5 space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Sequência</h4>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {camp.sequence.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className={cn(
                          "rounded-lg border p-3 min-w-[130px]",
                          step.type === "wait"
                            ? "bg-muted/30 border-border/50 text-muted-foreground"
                            : step.type === "email"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                              : "bg-purple-500/10 border-purple-500/30 text-purple-400"
                        )}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {stepIcons[step.type]}
                            <span className="text-xs font-medium">{step.label}</span>
                          </div>
                          {step.sent !== undefined && (
                            <div className="text-[10px] space-y-0.5 opacity-80">
                              <p>Enviados: {step.sent}</p>
                              <p>Abertos: {step.opened}</p>
                              <p>Respostas: {step.replied}</p>
                            </div>
                          )}
                        </div>
                        {i < camp.sequence.length - 1 && (
                          <div className="text-muted-foreground/30">→</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {camp.status === "active" ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        <Pause className="h-3 w-3" /> Pausar
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1 text-xs">
                        <Play className="h-3 w-3" /> Iniciar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <BarChart3 className="h-3 w-3" /> Relatório
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
