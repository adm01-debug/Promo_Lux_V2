import {
  LayoutDashboard, Target, Workflow, Building2, BarChart3, Radar,
  Mail, Bot, MapPin, Globe, Users, Settings, Database, Users2, Kanban, Webhook, ShieldAlert, ShieldCheck, Activity,
  HelpCircle, Keyboard, LifeBuoy, FileText,
} from "lucide-react";
import type { View } from "@/hooks/useNavigationHistory";

export const VIEW_ICONS: Record<View, React.ElementType> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  icp: Target,
  companies: Building2,
  intent: Radar,
  stakeholders: Users,
  workflows: Workflow,
  gmaps: MapPin,
  "scrape-results": Database,
  map: Globe,
  campaigns: Mail,
  "ai-agent": Bot,
  organizations: Users2,
  settings: Settings,
  deals: Kanban,
  integrations: Webhook,
  "org-violations": ShieldAlert,
  "rls-discovery": ShieldCheck,
  monitoring: Activity,
};

export const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  icp: "Configurar IPC",
  companies: "Empresas",
  intent: "Sinais de Intenção",
  stakeholders: "Stakeholders",
  workflows: "Workflows",
  gmaps: "Google Maps",
  "scrape-results": "Resultados de Raspagem",
  map: "Mapa de Empresas",
  campaigns: "Campanhas",
  "ai-agent": "Agente IA",
  organizations: "Workspaces",
  settings: "Configurações",
  deals: "Pipeline (Deals)",
  integrations: "API & Webhooks",
  "org-violations": "Violações de Organização",
  "rls-discovery": "RLS Discovery",
  monitoring: "Status do Sistema",
};

export const helpItems = [
  { id: "help-center", label: "Central de Ajuda", icon: HelpCircle, action: () => window.open("https://docs.lux-ai.com.br") },
  { id: "shortcuts", label: "Ver Atalhos de Teclado", icon: Keyboard, action: () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })) },
  { id: "support", label: "Falar com Suporte", icon: LifeBuoy, action: () => window.open("mailto:suporte@lux-ai.com.br") },
  { id: "api-docs", label: "Documentação da API", icon: FileText, action: () => window.open("https://api-docs.lux-ai.com.br") },
];

export const sections = [
  {
    label: "Principal",
    items: [
      { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
      { id: "analytics" as View, label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Prospecção",
    items: [
      { id: "icp" as View, label: "Configurar IPC", icon: Target },
      { id: "companies" as View, label: "Empresas", icon: Building2 },
      { id: "intent" as View, label: "Sinais de Intenção", icon: Radar },
      { id: "stakeholders" as View, label: "Stakeholders", icon: Users },
    ],
  },
  {
    label: "Vendas",
    items: [
      { id: "deals" as View, label: "Pipeline (Deals)", icon: Kanban },
    ],
  },
  {
    label: "Automação",
    items: [
      { id: "workflows" as View, label: "Workflows", icon: Workflow },
      { id: "gmaps" as View, label: "Google Maps", icon: MapPin },
      { id: "scrape-results" as View, label: "Resultados de Raspagem", icon: Database },
      { id: "map" as View, label: "Mapa de Empresas", icon: Globe },
      { id: "campaigns" as View, label: "Campanhas", icon: Mail },
      { id: "ai-agent" as View, label: "Agente IA", icon: Bot },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "organizations" as View, label: "Workspaces", icon: Users2 },
      { id: "integrations" as View, label: "API & Webhooks", icon: Webhook },
      { id: "org-violations" as View, label: "Violações de Organização", icon: ShieldAlert },
      { id: "rls-discovery" as View, label: "RLS Discovery", icon: ShieldCheck },
      { id: "monitoring" as View, label: "Status do Sistema", icon: Activity },
      { id: "settings" as View, label: "Configurações", icon: Settings },
    ],
  },
];
