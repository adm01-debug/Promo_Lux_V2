import { motion } from "framer-motion";
import { Target, MapPin, Bot, Workflow, ArrowRight } from "lucide-react";
import type { View } from "@/hooks/useNavigationHistory";

interface QuickAction {
  id: View;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: "icp",
    label: "Configurar IPC",
    description: "Defina seu perfil de cliente ideal",
    icon: Target,
    gradient: "from-primary/20 to-primary/5",
  },
  {
    id: "gmaps",
    label: "Raspar Google Maps",
    description: "Encontre empresas por localidade",
    icon: MapPin,
    gradient: "from-success/20 to-success/5",
  },
  {
    id: "workflows",
    label: "Criar Workflow",
    description: "Automatize sua prospecção",
    icon: Workflow,
    gradient: "from-warning/20 to-warning/5",
  },
  {
    id: "ai-agent",
    label: "Agente IA",
    description: "Converse com a inteligência artificial",
    icon: Bot,
    gradient: "from-accent/20 to-accent/5",
  },
];

interface QuickActionsProps {
  onNavigate: (view: View) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {ACTIONS.map((action, i) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.08 }}
          onClick={() => onNavigate(action.id)}
          className={`glass-interactive rounded-xl p-4 text-left group bg-gradient-to-br ${action.gradient}`}
        >
          <action.icon className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-semibold text-foreground">{action.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-2 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </motion.button>
      ))}
    </div>
  );
}
