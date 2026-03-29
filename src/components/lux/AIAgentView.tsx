import { useState } from "react";
import { Bot, Send, Sparkles, Loader2, Search, Database, Globe, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  actions?: { label: string; type: string }[];
}

const mockConversation: AgentMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Encontre empresas de SaaS B2B em São Paulo com mais de 50 funcionários que receberam investimento nos últimos 6 meses",
    timestamp: "14:32",
  },
  {
    id: "2",
    role: "agent",
    content: "🔍 Analisando sua solicitação...\n\n✅ Critérios identificados:\n• Setor: SaaS B2B\n• Localização: São Paulo\n• Funcionários: >50\n• Sinal: Investimento recente (6 meses)\n\nEncontrei **23 empresas** que correspondem aos critérios. As 5 com maior score IPC:\n\n1. **TechNova Solutions** — Score 94 — Série A R$15M (Fev 2025)\n2. **CloudBridge Inc** — Score 85 — Seed R$3M (Jan 2025)\n3. **DataPipeline.io** — Score 82 — Série B R$40M (Dez 2024)\n4. **APIHub Brasil** — Score 78 — Pre-Seed R$1.2M (Mar 2025)\n5. **SaaSMetrics** — Score 75 — Série A R$8M (Jan 2025)\n\nDeseja que eu enriqueça os dados dessas empresas ou inicie uma campanha de outreach?",
    timestamp: "14:32",
    actions: [
      { label: "Enriquecer todas", type: "enrich" },
      { label: "Criar campanha", type: "campaign" },
      { label: "Adicionar ao CRM", type: "crm" },
      { label: "Exportar CSV", type: "export" },
    ],
  },
  {
    id: "3",
    role: "user",
    content: "Enriqueça as top 5 e me diga quem são os decision makers",
    timestamp: "14:33",
  },
  {
    id: "4",
    role: "agent",
    content: "🔄 Executando waterfall enrichment nas 5 empresas...\n\n**TechNova Solutions:**\n• CEO: Ana Silva — ana@technova.com.br — LinkedIn ✓\n• CTO: Pedro Santos — pedro@technova.com.br — LinkedIn ✓\n• VP Sales: Maria Costa — maria@technova.com.br\n\n**CloudBridge Inc:**\n• CEO: João Pereira — joao@cloudbridge.io — LinkedIn ✓\n• Head of Growth: Lucas Mendes — lucas@cloudbridge.io\n\n**DataPipeline.io:**\n• CEO/Founder: Roberto Lima — roberto@datapipeline.io — LinkedIn ✓\n• COO: Fernanda Alves — fernanda@datapipeline.io\n\n📊 **Resumo:** 12 contatos encontrados, 8 com email verificado, 5 com LinkedIn confirmado.\n\nPróximos passos recomendados: Criar sequência de outreach personalizada para os C-levels.",
    timestamp: "14:34",
    actions: [
      { label: "Criar sequência de email", type: "sequence" },
      { label: "Conectar no LinkedIn", type: "linkedin" },
      { label: "Ver perfis completos", type: "profiles" },
    ],
  },
];

const capabilities = [
  { icon: <Search className="h-4 w-4" />, label: "Busca inteligente de empresas por critérios naturais" },
  { icon: <Database className="h-4 w-4" />, label: "Enriquecimento em cascata com múltiplos provedores" },
  { icon: <Globe className="h-4 w-4" />, label: "Raspagem web com AI para dados de contato" },
  { icon: <Brain className="h-4 w-4" />, label: "Análise de sinais de intenção e scoring automático" },
];

export const AIAgentView = () => {
  const [input, setInput] = useState("");
  const [messages] = useState(mockConversation);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Agente IA — Claygent Style
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Inspirado no Claygent/Prospectory — converse em linguagem natural para prospectar
        </p>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-4 gap-3">
        {capabilities.map((cap) => (
          <div key={cap.label} className="glass rounded-lg p-3 flex items-center gap-2.5">
            <div className="text-primary/70">{cap.icon}</div>
            <span className="text-xs text-muted-foreground">{cap.label}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="glass rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 340px)" }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${msg.role === "user" ? "bg-primary/10 border-primary/20" : "bg-secondary/50 border-border/30"} border rounded-lg p-4`}>
                {msg.role === "agent" && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">LUX IA Agent</span>
                  </div>
                )}
                <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">{msg.content}</div>
                {msg.actions && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.actions.map((a) => (
                      <Button key={a.label} size="sm" variant="outline" className="text-xs h-7 gap-1">
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Encontre fintechs em Curitiba com +100 funcionários..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && setInput("")}
            />
            <Button size="icon" className="flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            {["Encontre empresas de...", "Enriqueça os dados de...", "Crie uma campanha para..."].map((sug) => (
              <button
                key={sug}
                onClick={() => setInput(sug)}
                className="text-[10px] text-muted-foreground bg-secondary/50 rounded-full px-3 py-1 hover:text-foreground hover:bg-secondary transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
