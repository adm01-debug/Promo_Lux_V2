import { motion } from "framer-motion";
import { Target, MapPin, Bot, Workflow, ArrowRight } from "lucide-react";
import type { View } from "@/hooks/useNavigationHistory";

interface QuickAction {
  id: View;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: "icp",
    label: "Configurar IPC",
    description: "Defina seu perfil de cliente ideal",
    icon: Target,
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
  },
  {
    id: "gmaps",
    label: "Raspar Google Maps",
    description: "Encontre empresas por localidade",
    icon: MapPin,
    gradient: "from-success/20 to-success/5",
    iconColor: "text-success",
  },
  {
    id: "workflows",
    label: "Criar Workflow",
    description: "Automatize sua prospecção",
    icon: Workflow,
    gradient: "from-warning/20 to-warning/5",
    iconColor: "text-warning",
  },
  {
    id: "ai-agent",
    label: "Agente IA",
    description: "Converse com a inteligência artificial",
    icon: Bot,
    gradient: "from-accent/20 to-accent/5",
    iconColor: "text-accent",
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
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate(action.id)}
          className={`glass-interactive rounded-xl p-4 text-left group bg-gradient-to-br ${action.gradient} hover:shadow-[0_8px_24px_hsl(var(--primary)/0.12)] transition-shadow duration-300`}
        >
          <motion.div
            className="inline-flex"
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <action.icon className={`h-5 w-5 ${action.iconColor} mb-2 drop-shadow-[0_0_4px_hsl(var(--primary)/0.3)]`} />
          </motion.div>
          <p className="text-sm font-semibold text-foreground">{action.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
          <div className="flex items-center gap-1 mt-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <span className="text-[10px] text-primary font-medium">Acessar</span>
            <ArrowRight className="h-3 w-3 text-primary" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}
