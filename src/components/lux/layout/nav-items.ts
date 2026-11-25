import {
  Search,
  LayoutDashboard,
  Target,
  Workflow,
  Building2,
  BarChart3,
  Radar,
  Mail,
  Bot,
  MapPin,
  Globe,
  Users,
  Users2,
  Database,
  Settings,
  Kanban,
  Webhook,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Activity,
  Trash2,
  Gauge,
  Building,
} from "lucide-react";
import { View } from "@/hooks/useNavigationHistory";

interface NavItemBase {
  label: string;
  icon: React.ElementType;
  section?: string;
}

/** Item que abre uma view do registry (`/?view=<id>`). */
export interface NavViewItem extends NavItemBase {
  id: View;
}

/** Item que abre uma rota real do SPA, fora do registry de views. */
export interface NavLinkItem extends NavItemBase {
  path: string;
  /** Só aparece para administrador da organização ativa. */
  adminOnly?: boolean;
}

export type NavItem = NavViewItem | NavLinkItem;

export const isNavLink = (item: NavItem): item is NavLinkItem => "path" in item;

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Principal" },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "icp", label: "Configurar IPC", icon: Target, section: "Prospecção" },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "intent", label: "Sinais de Intenção", icon: Radar },
  { id: "stakeholders", label: "Stakeholders", icon: Users },
  { id: "lusha", label: "Oráculo", icon: Search },
  { id: "deals", label: "Pipeline (Deals)", icon: Kanban, section: "Vendas" },
  { id: "workflows", label: "Workflows", icon: Workflow, section: "Automação" },
  { id: "gmaps", label: "Google Maps", icon: MapPin },
  { id: "scrape-results", label: "Resultados Raspagem", icon: Database },
  { id: "map", label: "Mapa de Empresas", icon: Globe },
  { id: "campaigns", label: "Campanhas", icon: Mail },
  { id: "suppressions", label: "Lista de Supressão", icon: ShieldOff },
  { id: "ai-agent", label: "Agente IA", icon: Bot },
  { id: "automations", label: "Automações (Tempo Real)", icon: Activity },
  { id: "organizations", label: "Workspaces", icon: Users2, section: "Sistema" },
  { path: "/admin/companies", label: "Empresas (Admin)", icon: Building, adminOnly: true },
  { id: "integrations", label: "API & Webhooks", icon: Webhook },
  { id: "org-violations", label: "Violações de Org", icon: ShieldAlert },
  { id: "rls-discovery", label: "RLS Discovery", icon: ShieldCheck },
  { id: "monitoring", label: "Status do Sistema", icon: Activity },
  { path: "/monitoring", label: "Monitoramento", icon: Gauge, adminOnly: true },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "recycle-bin", label: "Lixeira", icon: Trash2 },
];
