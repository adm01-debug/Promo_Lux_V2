import { Radar, TrendingUp, Eye, Globe, Briefcase, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SignalType = "website_visit" | "hiring" | "funding" | "tech_adoption" | "content_engagement";

interface IntentSignal {
  id: string;
  company: string;
  type: SignalType;
  signal: string;
  strength: "high" | "medium" | "low";
  timestamp: string;
  details: string;
}

const signalConfig: Record<SignalType, { label: string; icon: React.ReactNode; color: string }> = {
  website_visit: { label: "Visita ao Site", icon: <Eye className="h-3.5 w-3.5" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  hiring: { label: "Contratando", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  funding: { label: "Rodada de Investimento", icon: <TrendingUp className="h-3.5 w-3.5" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  tech_adoption: { label: "Adoção de Tech", icon: <Globe className="h-3.5 w-3.5" />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  content_engagement: { label: "Engajamento", icon: <Eye className="h-3.5 w-3.5" />, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

const strengthColors: Record<string, string> = {
  high: "bg-success/20 text-success border-success/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
};

const mockSignals: IntentSignal[] = [
  { id: "1", company: "TechNova Solutions", type: "website_visit", signal: "Visitou página de pricing 3x", strength: "high", timestamp: "5 min atrás", details: "3 visitas na página de preços nos últimos 2 dias, vindas de 2 IPs diferentes" },
  { id: "2", company: "DataFlow Analytics", type: "hiring", signal: "Contratando Head de Tecnologia", strength: "high", timestamp: "1h atrás", details: "Vaga publicada no LinkedIn para Head de Tecnologia — indica expansão" },
  { id: "3", company: "CloudBridge Inc", type: "funding", signal: "Série B — R$ 30M", strength: "high", timestamp: "2h atrás", details: "Anúncio de rodada Série B liderada por Softbank Latin America" },
  { id: "4", company: "FinEdge Pay", type: "tech_adoption", signal: "Adotou Kubernetes + AWS", strength: "medium", timestamp: "3h atrás", details: "Stack tecnológico atualizado detectado via BuiltWith" },
  { id: "5", company: "MedConnect Health", type: "content_engagement", signal: "Download de whitepaper", strength: "medium", timestamp: "4h atrás", details: "Baixou o whitepaper 'Automação em Saúde 2025'" },
  { id: "6", company: "LogiTrack Systems", type: "hiring", signal: "5 vagas abertas em TI", strength: "medium", timestamp: "6h atrás", details: "Vagas publicadas para dev backend, frontend, devops, QA e PM" },
  { id: "7", company: "EduPlatform BR", type: "website_visit", signal: "Visitou blog 2x", strength: "low", timestamp: "8h atrás", details: "2 visitas ao blog sobre integração de APIs" },
  { id: "8", company: "AgriSmart Tech", type: "tech_adoption", signal: "Migrou para cloud GCP", strength: "low", timestamp: "12h atrás", details: "Detectada migração de infraestrutura on-premise para Google Cloud" },
];

export const IntentSignalsView = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Sinais de Intenção de Compra
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inspirado em ZoomInfo/Cognism — monitore sinais que indicam propensão de compra
          </p>
        </div>
        <Button variant="outline" className="gap-2 text-sm">
          <Radar className="h-4 w-4" />
          Configurar Sinais
        </Button>
      </div>

      {/* Signal strength summary */}
      <div className="grid grid-cols-3 gap-4">
        {(["high", "medium", "low"] as const).map((str) => {
          const count = mockSignals.filter(s => s.strength === str).length;
          const labels = { high: "Alta Intenção", medium: "Média Intenção", low: "Baixa Intenção" };
          return (
            <div key={str} className="glass rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{labels[str]}</span>
                <Badge variant="outline" className={`text-xs ${strengthColors[str]}`}>{count}</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground mt-2">{count}</p>
              <p className="text-xs text-muted-foreground">sinais detectados</p>
            </div>
          );
        })}
      </div>

      {/* Signals list */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-foreground text-sm">Feed de Sinais em Tempo Real</h3>
        </div>
        <div className="divide-y divide-border/20">
          {mockSignals.map((signal) => {
            const config = signalConfig[signal.type];
            return (
              <div key={signal.id} className="p-4 hover:bg-secondary/20 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${config.color} flex-shrink-0 mt-0.5`}>
                      {config.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">{signal.company}</span>
                        <Badge variant="outline" className={`text-[10px] ${strengthColors[signal.strength]}`}>
                          {signal.strength === "high" ? "🔥 Alta" : signal.strength === "medium" ? "Média" : "Baixa"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{signal.signal}</p>
                      <p className="text-xs text-muted-foreground mt-1">{signal.details}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{signal.timestamp}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-xs">
                    Ver empresa <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
