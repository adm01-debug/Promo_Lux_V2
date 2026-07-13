import { useState, useEffect, useMemo } from "react";
import { Settings, User, Bell, Link2, Key, Shield, Save, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/usePermissions";
import { RLSVerificationPanel } from "@/components/lux/settings/RLSVerificationPanel";
import { RLSRegistryCoverage } from "@/components/lux/settings/RLSRegistryCoverage";
import { MFASetup } from "@/components/lux/settings/MFASetup";
import { useUnsavedChanges } from "@/hooks/unsaved-changes-context";
import { StickySaveBar } from "./StickySaveBar";

type SettingsTab = "account" | "notifications" | "integrations" | "api";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Conta", icon: <User className="h-4 w-4" /> },
  { id: "notifications", label: "Notificações", icon: <Bell className="h-4 w-4" /> },
  { id: "integrations", label: "Integrações", icon: <Link2 className="h-4 w-4" /> },
  { id: "api", label: "API & Chaves", icon: <Key className="h-4 w-4" /> },
];

const integrations = [
  { name: "Google Maps Scraper", status: "connected", icon: "🗺️", desc: "Raspagem automatizada de empresas" },
  { name: "Lovable AI Agent", status: "connected", icon: "🤖", desc: "Agente IA para consultas inteligentes" },
  { name: "Lovable Cloud", status: "connected", icon: "☁️", desc: "Backend, banco de dados e auth" },
];

interface NotifPrefs {
  email_notifs: boolean;
  signal_notifs: boolean;
  scrape_notifs: boolean;
  weekly_report: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { email_notifs: true, signal_notifs: true, scrape_notifs: true, weekly_report: false };

export const SettingsView = () => {
  const { user } = useAuth();
  const isAdmin = useCan("audit_logs", "view");
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [saving, setSaving] = useState(false);

  // Initial values for dirty check
  const [initialFullName, setInitialFullName] = useState("");
  const [initialNotifPrefs, setInitialNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  // Account fields
  const [fullName, setFullName] = useState("");

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, notification_prefs")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) {
          setFullName(data.full_name);
          setInitialFullName(data.full_name);
        }
        if (data?.notification_prefs) {
          const prefs = { ...DEFAULT_PREFS, ...(data.notification_prefs as unknown as NotifPrefs) };
          setNotifPrefs(prefs);
          setInitialNotifPrefs(prefs);
        }
      });
  }, [user]);

  const isDirty = useMemo(() => {
    if (activeTab === "account") {
      return fullName !== initialFullName || !!newPassword;
    }
    if (activeTab === "notifications") {
      return JSON.stringify(notifPrefs) !== JSON.stringify(initialNotifPrefs);
    }
    return false;
  }, [fullName, initialFullName, newPassword, notifPrefs, initialNotifPrefs, activeTab]);

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
    return () => setHasUnsavedChanges(false);
  }, [isDirty, setHasUnsavedChanges]);

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (activeTab === "account") {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", user.id);
        if (error) throw error;
        setInitialFullName(fullName);

        if (newPassword) {
          if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem.");
          if (newPassword.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
          const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
          if (pwError) throw pwError;
          setNewPassword("");
          setConfirmPassword("");
        }
      } else if (activeTab === "notifications") {
        const { error } = await supabase
          .from("profiles")
          .update({ notification_prefs: notifPrefs as unknown as Record<string, boolean> })
          .eq("id", user.id);
        if (error) throw error;
        setInitialNotifPrefs(notifPrefs);
      }
      
      toast({ title: "Salvo!", description: "Informações atualizadas com sucesso." });
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (activeTab === "account") {
      setFullName(initialFullName);
      setNewPassword("");
      setConfirmPassword("");
    } else if (activeTab === "notifications") {
      setNotifPrefs(initialNotifPrefs);
    }
  };

  const updateNotifPref = (key: keyof NotifPrefs, value: boolean) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
  };


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
            {tabs.map((tab) => (
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
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={user?.email || ""} disabled className="h-9 text-sm opacity-60" />
                </div>
              </div>
              <Separator className="bg-border/30" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Alterar Senha
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nova Senha</Label>
                    <Input
                      type="password"
                      placeholder="Mín. 8 caracteres"
                      className="h-9 text-sm"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Confirmar Senha</Label>
                    <Input
                      type="password"
                      placeholder="Repita a senha"
                      className="h-9 text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleSaveAll} disabled={saving} className="gap-2 sm:flex hidden">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>

              <Separator className="bg-border/30" />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Autenticação de Dois Fatores
                </h4>
                <MFASetup />
              </div>

              <Separator className="bg-border/30" />

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-primary" /> Tour de Onboarding
                </h4>
                <p className="text-xs text-muted-foreground">
                  Reveja o tour interativo que apresenta as funcionalidades principais da plataforma.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    localStorage.removeItem("lux-onboarding-done");
                    if (user) {
                      supabase
                        .from("profiles")
                        .update({ onboarding_completed: false } as Record<string, unknown>)
                        .eq("id", user.id)
                        .then(() => {
                          toast({ title: "Tour reiniciado!", description: "Recarregue a página para iniciar o tour." });
                          setTimeout(() => window.location.reload(), 1000);
                        });
                    } else {
                      window.location.reload();
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar Tour
                </Button>
              </div>

              {isAdmin && (
                <>
                  <Separator className="bg-border/30" />
                  <RLSRegistryCoverage />
                  <RLSVerificationPanel />
                </>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Preferências de Notificação</h3>
              <div className="space-y-4">
                {[
                  { key: "email_notifs" as const, label: "Notificações por email", desc: "Receba alertas importantes no seu email" },
                  { key: "signal_notifs" as const, label: "Sinais de intenção", desc: "Alerta quando um sinal de alta intenção é detectado" },
                  { key: "scrape_notifs" as const, label: "Raspagens concluídas", desc: "Notifique quando uma raspagem terminar" },
                  { key: "weekly_report" as const, label: "Relatório semanal", desc: "Resumo semanal dos resultados por email" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={notifPrefs[item.key]} onCheckedChange={(v) => updateNotifPref(item.key, v)} />
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveAll} disabled={saving} className="gap-2 sm:flex hidden">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Integrações Ativas</h3>
              <div className="space-y-3">
                {integrations.map((int) => (
                  <div key={int.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/20">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{int.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{int.name}</p>
                        <p className="text-xs text-muted-foreground">{int.desc}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                      Conectado
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="glass rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Informações do Projeto</h3>
              <p className="text-sm text-muted-foreground">Dados da sua instância para integrações externas</p>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/20 space-y-2">
                  <p className="text-sm font-medium text-foreground">URL da API</p>
                  <p className="text-xs font-mono text-muted-foreground bg-background/50 rounded px-2 py-1 select-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/20 space-y-2">
                  <p className="text-sm font-medium text-foreground">Chave Pública (anon)</p>
                  <p className="text-xs font-mono text-muted-foreground bg-background/50 rounded px-2 py-1 break-all select-all">
                    {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.slice(0, 30)}••••••
                  </p>
                  <p className="text-[10px] text-muted-foreground">Use esta chave no header <code>apikey</code> para chamar as edge functions</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <StickySaveBar
        isVisible={isDirty}
        isSaving={saving}
        onSave={handleSaveAll}
        onCancel={handleDiscard}
      />
    </div>
  );
};
