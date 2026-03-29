import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
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
  Settings,
} from "lucide-react";
import { View } from "@/hooks/useNavigationHistory";

interface CommandPaletteProps {
  onNavigate: (view: View) => void;
}

const sections = [
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

export const CommandPalette = ({ onNavigate }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (view: View) => {
    onNavigate(view);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar seções, empresas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {sections.map((section, i) => (
          <div key={section.label}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={section.label}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item.id)}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
