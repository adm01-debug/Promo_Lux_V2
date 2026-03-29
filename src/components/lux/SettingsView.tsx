import { useState } from "react";
import { Settings, User, Bell, Link2, Key, Shield, Moon, Sun, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

type SettingsTab = "account" | "notifications" | "integrations" | "api";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Conta", icon: <User className="h-4 w-4" /> },
  { id: "notifications", label: "Notificações", icon: <Bell className="h-4 w-4" /> },
  { id: "integrations", label: "Integrações", icon: <Link2 className="h-4 w-4" /> },
  { id: "api", label: "API & Chaves", icon: <Key className="h-4 w-4" /> },
];

const integrations = [
  { name: "LinkedIn Sales Navigator", status: "connected", icon: "🔗" },
  { name: "Hunter.io", status: "connected", icon: "📧" },
  { name: "Google Maps API", status: "connected", icon: "🗺️" },
  { name: "HubSpot CRM", status: "disconnected", icon: "🔶" },
  { name: "Slack", status: "disconnected", icon: "💬" },
  { name: "Receita Federal (CNPJ)", status: "connected", icon: "🏛️" },
];

export const SettingsView = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [signalNotifs, setSignalNotifs] = useState(true);
  const [scrapeNotifs, setScrapeNotifs] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conta, integrações e preferências</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Tab nav */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass rounded-lg p-2 flex lg:flex-col gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all w-full text-left ${
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <motion.div key={activeTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
          {activeTab === "account" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Informações da Conta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input defaultValue="Lucas Xavier" className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input defaultValue="lucas@luxia.com.br" className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input defaultValue="LUX IA" className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cargo</Label>
                  <Input defaultValue="CEO & Founder" className="h-9 text-sm" />
                </div>
              </div>
              <Separator className="bg-border/30" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Segurança
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Senha Atual</Label>
                    <Input type="password" placeholder="••••••••" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nova Senha</Label>
                    <Input type="password" placeholder="••••••••" className="h-9 text-sm" />
                  </div>
                </div>
              </div>
              <Button className="gap-2">
                <Save className="h-4 w-4" /> Salvar Alterações
              </Button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Preferências de Notificação</h3>
              <div className="space-y-4">
                {[
                  { label: "Notificações por email", desc: "Receba alertas importantes no seu email", checked: emailNotifs, onChange: setEmailNotifs },
                  { label: "Sinais de intenção", desc: "Alerta quando um sinal de alta intenção é detectado", checked: signalNotifs, onChange: setSignalNotifs },
                  { label: "Raspagens concluídas", desc: "Notifique quando uma raspagem terminar", checked: scrapeNotifs, onChange: setScrapeNotifs },
                  { label: "Relatório semanal", desc: "Resumo semanal dos resultados por email", checked: weeklyReport, onChange: setWeeklyReport },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.checked} onCheckedChange={item.onChange} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Integrações</h3>
              <div className="space-y-3">
                {integrations.map(int => (
                  <div key={int.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/20">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{int.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{int.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${int.status === "connected" ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                          {int.status === "connected" ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" variant={int.status === "connected" ? "outline" : "default"} className="text-xs h-8">
                      {int.status === "connected" ? "Configurar" : "Conectar"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
              <p className="text-sm text-muted-foreground">Gerencie suas chaves de API para integrações externas</p>
              <div className="space-y-4">
                {[
                  { name: "LUX IA API Key", key: "lux_sk_••••••••••••7f3a", created: "10 Mar 2025" },
                  { name: "Webhook Secret", key: "whsec_••••••••••••9b2d", created: "15 Mar 2025" },
                ].map(apiKey => (
                  <div key={apiKey.name} className="p-4 rounded-lg bg-secondary/30 border border-border/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{apiKey.name}</p>
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Ativa</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground bg-background/50 rounded px-2 py-1">{apiKey.key}</p>
                    <p className="text-[10px] text-muted-foreground">Criada em {apiKey.created}</p>
                  </div>
                ))}
                <Button variant="outline" className="gap-2 text-sm">
                  <Key className="h-4 w-4" /> Gerar Nova Chave
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
