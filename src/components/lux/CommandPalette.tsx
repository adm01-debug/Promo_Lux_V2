import { useEffect, useState, useMemo } from "react";
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
  Clock,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { View } from "@/hooks/useNavigationHistory";
import { RecentView } from "@/hooks/useRecentViews";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface CommandPaletteProps {
  onNavigate: (view: View) => void;
  recentViews?: RecentView[];
}

const VIEW_ICONS: Record<View, React.ElementType> = {
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

const VIEW_LABELS: Record<View, string> = {
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

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
}

export const CommandPalette = ({ onNavigate, recentViews = [] }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch companies for search
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["command-palette-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, sector, location, ipc_score")
        .order("ipc_score", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Fetch stakeholders for search
  const { data: stakeholders = [] } = useQuery({
    queryKey: ["command-palette-stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholders")
        .select("id, full_name, role, company_id, email")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Fetch workflows for search
  const { data: workflows = [] } = useQuery({
    queryKey: ["command-palette-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("id, name, status, description")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Filter companies by search term
  const filteredCompanies = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.sector?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [companies, search]);

  // Filter stakeholders
  const filteredStakeholders = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return stakeholders
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.role?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [stakeholders, search]);

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return workflows
      .filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [workflows, search]);

  // Quick actions
  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: "new-workflow",
        label: "Criar Workflow",
        icon: Workflow,
        action: () => {
          onNavigate("workflows");
          toast({ title: "Novo Workflow", description: "Navegando para criar workflow..." });
        },
      },
      {
        id: "new-campaign",
        label: "Nova Campanha",
        icon: Mail,
        action: () => {
          onNavigate("campaigns");
          toast({ title: "Nova Campanha", description: "Navegando para campanhas..." });
        },
      },
      {
        id: "new-scrape",
        label: "Nova Raspagem Google Maps",
        icon: MapPin,
        action: () => {
          onNavigate("gmaps");
          toast({ title: "Nova Raspagem", description: "Navegando para Google Maps Scraper..." });
        },
      },
      {
        id: "configure-ipc",
        label: "Configurar IPC",
        icon: Target,
        action: () => {
          onNavigate("icp");
        },
      },
    ],
    [onNavigate]
  );

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

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const handleSelect = (view: View) => {
    onNavigate(view);
    setOpen(false);
  };

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  const handleCompanySelect = (companyName: string) => {
    onNavigate("companies");
    setOpen(false);
    toast({
      title: "Empresa selecionada",
      description: `Navegando para "${companyName}"`,
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar seções, empresas, ações..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              value={`ação ${action.label}`}
              onSelect={() => handleAction(action.action)}
              className="cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4 text-primary" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        {/* Company search results */}
        {filteredCompanies.length > 0 && (
          <>
            <CommandGroup heading="Empresas encontradas">
              {filteredCompanies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={`empresa ${company.name} ${company.sector ?? ""} ${company.location ?? ""}`}
                  onSelect={() => handleCompanySelect(company.name)}
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm">{company.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {[company.sector, company.location, company.ipc_score ? `Score: ${company.ipc_score}` : null]
                        .filter(Boolean)
                        .join(" • ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Loading indicator for companies */}
        {companiesLoading && search.length >= 2 && (
          <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Buscando empresas...
          </div>
        )}

        {/* Recent views */}
        {recentViews.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recentViews.map((rv) => (
                <CommandItem
                  key={rv.id}
                  value={`recente ${VIEW_LABELS[rv.id]}`}
                  onSelect={() => handleSelect(rv.id)}
                  className="cursor-pointer"
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{VIEW_LABELS[rv.id]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation sections */}
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
