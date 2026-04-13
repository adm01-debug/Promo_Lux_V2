import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Building2, Users, Workflow, MapPin, Mail, Target, Clock, Plus, Loader2 } from "lucide-react";
import { View } from "@/hooks/useNavigationHistory";
import { RecentView } from "@/hooks/useRecentViews";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { VIEW_LABELS, sections } from "./command-palette/commandPaletteData";

interface CommandPaletteProps {
  onNavigate: (view: View) => void;
  recentViews?: RecentView[];
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
}

export const CommandPalette = ({ onNavigate, recentViews = [] }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["command-palette-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, sector, location, ipc_score").order("ipc_score", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["command-palette-stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders").select("id, full_name, role, company_id, email").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ["command-palette-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflows").select("id, name, status, description").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const filteredCompanies = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.sector?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q)).slice(0, 5);
  }, [companies, search]);

  const filteredStakeholders = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return stakeholders.filter((s) => s.full_name.toLowerCase().includes(q) || s.role?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)).slice(0, 5);
  }, [stakeholders, search]);

  const filteredWorkflows = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return workflows.filter((w) => w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)).slice(0, 5);
  }, [workflows, search]);

  const quickActions: QuickAction[] = useMemo(() => [
    { id: "new-workflow", label: "Criar Workflow", icon: Workflow, action: () => { onNavigate("workflows"); toast({ title: "Novo Workflow" }); } },
    { id: "new-campaign", label: "Nova Campanha", icon: Mail, action: () => { onNavigate("campaigns"); toast({ title: "Nova Campanha" }); } },
    { id: "new-scrape", label: "Nova Raspagem Google Maps", icon: MapPin, action: () => { onNavigate("gmaps"); toast({ title: "Nova Raspagem" }); } },
    { id: "configure-ipc", label: "Configurar IPC", icon: Target, action: () => { onNavigate("icp"); } },
  ], [onNavigate]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); } };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => { if (!open) setSearch(""); }, [open]);

  const handleSelect = (view: View) => { onNavigate(view); setOpen(false); };
  const handleAction = (action: () => void) => { action(); setOpen(false); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar seções, empresas, ações..." value={search} onValueChange={setSearch} />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((action) => (
            <CommandItem key={action.id} value={`ação ${action.label}`} onSelect={() => handleAction(action.action)} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4 text-primary" /><span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        {filteredCompanies.length > 0 && (
          <>
            <CommandGroup heading="Empresas encontradas">
              {filteredCompanies.map((company) => (
                <CommandItem key={company.id} value={`empresa ${company.name} ${company.sector ?? ""}`} onSelect={() => { onNavigate("companies"); setOpen(false); toast({ title: "Empresa selecionada", description: company.name }); }} className="cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col"><span className="text-sm">{company.name}</span><span className="text-[10px] text-muted-foreground">{[company.sector, company.location, company.ipc_score ? `Score: ${company.ipc_score}` : null].filter(Boolean).join(" • ")}</span></div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredStakeholders.length > 0 && (
          <>
            <CommandGroup heading="Stakeholders encontrados">
              {filteredStakeholders.map((s) => (
                <CommandItem key={s.id} value={`stakeholder ${s.full_name} ${s.role ?? ""}`} onSelect={() => { onNavigate("stakeholders"); setOpen(false); toast({ title: "Stakeholder", description: s.full_name }); }} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col"><span className="text-sm">{s.full_name}</span><span className="text-[10px] text-muted-foreground">{[s.role, s.email].filter(Boolean).join(" • ")}</span></div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredWorkflows.length > 0 && (
          <>
            <CommandGroup heading="Workflows encontrados">
              {filteredWorkflows.map((w) => (
                <CommandItem key={w.id} value={`workflow ${w.name}`} onSelect={() => { onNavigate("workflows"); setOpen(false); toast({ title: "Workflow", description: w.name }); }} className="cursor-pointer">
                  <Workflow className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col"><span className="text-sm">{w.name}</span><span className="text-[10px] text-muted-foreground">{[w.status, w.description?.slice(0, 40)].filter(Boolean).join(" • ")}</span></div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {companiesLoading && search.length >= 2 && (
          <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
          </div>
        )}

        {recentViews.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recentViews.map((rv) => (
                <CommandItem key={rv.id} value={`recente ${VIEW_LABELS[rv.id]}`} onSelect={() => handleSelect(rv.id)} className="cursor-pointer">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" /><span>{VIEW_LABELS[rv.id]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {sections.map((section, i) => (
          <div key={section.label}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={section.label}>
              {section.items.map((item) => (
                <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.id)} className="cursor-pointer">
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" /><span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="border-t border-border/50 px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground/60">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">↵</kbd> selecionar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">esc</kbd> fechar</span>
        </div>
      </div>
    </CommandDialog>
  );
};
