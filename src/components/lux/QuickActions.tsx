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
  kbd: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: "icp",
    label: "Configurar IPC",
    description: "Defina seu perfil de cliente ideal",
    icon: Target,
    gradient: "from-primary/20 via-primary/10 to-transparent",
    iconColor: "text-primary",
    kbd: "I",
  },
  {
    id: "gmaps",
    label: "Novo Scrape",
    description: "Encontre empresas por localidade",
    icon: MapPin,
    gradient: "from-success/20 via-success/10 to-transparent",
    iconColor: "text-success",
    kbd: "G",
  },
  {
    id: "workflows",
    label: "Novo Workflow",
    description: "Automatize sua prospecção",
    icon: Workflow,
    gradient: "from-warning/20 via-warning/10 to-transparent",
    iconColor: "text-warning",
    kbd: "W",
  },
  {
    id: "ai-agent",
    label: "Abrir IA",
    description: "Converse com a inteligência artificial",
    icon: Bot,
    gradient: "from-accent/20 via-accent/10 to-transparent",
    iconColor: "text-accent",
    kbd: "A",
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
          transition={{ delay: 0.3 + i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          whileHover={{
            y: -5,
            scale: 1.03,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onNavigate(action.id)}
          className={`glass-interactive rounded-xl p-4 text-left group bg-gradient-to-br ${action.gradient} hover:shadow-[0_12px_32px_hsl(var(--primary)/0.12)] transition-shadow duration-300 relative overflow-hidden`}
        >
          {/* Hover shimmer overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <motion.div
              className="inline-flex"
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center ring-1 ring-border/30 group-hover:ring-primary/30 transition-all">
                <action.icon className={`h-4.5 w-4.5 ${action.iconColor} drop-shadow-[0_0_4px_hsl(var(--primary)/0.3)]`} />
              </div>
            </motion.div>
            <span className="text-[9px] font-mono text-muted-foreground/50 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {action.kbd}
            </span>
          </div>

          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200">{action.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>

          <div className="flex items-center gap-1 mt-2.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <span className="text-[10px] text-primary font-medium">Acessar</span>
            <ArrowRight className="h-3 w-3 text-primary" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}
