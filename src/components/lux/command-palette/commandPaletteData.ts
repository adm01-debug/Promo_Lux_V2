import {
  LayoutDashboard, Target, Workflow, Building2, BarChart3, Radar,
  Mail, Bot, MapPin, Globe, Users, Settings,
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
  map: Globe,
  campaigns: Mail,
  "ai-agent": Bot,
  settings: Settings,
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
  map: "Mapa de Empresas",
  campaigns: "Campanhas",
  "ai-agent": "Agente IA",
  settings: "Configurações",
};

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
    label: "Automação",
    items: [
      { id: "workflows" as View, label: "Workflows", icon: Workflow },
      { id: "gmaps" as View, label: "Google Maps", icon: MapPin },
      { id: "map" as View, label: "Mapa de Empresas", icon: Globe },
      { id: "campaigns" as View, label: "Campanhas", icon: Mail },
      { id: "ai-agent" as View, label: "Agente IA", icon: Bot },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "settings" as View, label: "Configurações", icon: Settings },
    ],
  },
];
