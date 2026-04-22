import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyOrganizations, useActiveOrganization } from "@/hooks/useOrganizations";
import { Badge } from "@/components/ui/badge";

interface WorkspaceSwitcherProps {
  onManage: () => void;
}

export const WorkspaceSwitcher = ({ onManage }: WorkspaceSwitcherProps) => {
  const { data: orgs } = useMyOrganizations();
  const { activeOrgId, activeOrg, setActive } = useActiveOrganization();

  if (!orgs || orgs.length === 0) {
    return (
      <button
        onClick={onManage}
        className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-dashed border-border/40"
      >
        <Plus className="h-3.5 w-3.5" />
        Criar workspace
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-border/40 max-w-[200px]">
          <Building2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="font-medium text-foreground truncate">
            {activeOrg?.organizations.name ?? "Selecionar"}
          </span>
          <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.organization_id} onClick={() => setActive(o.organization_id)} className="gap-2">
            <Check className={`h-3.5 w-3.5 ${activeOrgId === o.organization_id ? "text-primary" : "opacity-0"}`} />
            <span className="flex-1 truncate">{o.organizations.name}</span>
            <Badge variant="outline" className="text-[9px]">{o.role}</Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onManage} className="gap-2 text-primary">
          <Plus className="h-3.5 w-3.5" />
          Gerenciar workspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
