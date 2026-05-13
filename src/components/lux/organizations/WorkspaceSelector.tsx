import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type AppRole } from "@/hooks/useOrganizations";

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", sdr: "SDR", viewer: "Viewer" };

interface WorkspaceSelectorProps {
  orgs: any[];
  activeOrgId: string | null;
  setActive: (id: string) => void;
}

export const WorkspaceSelector = ({ orgs, activeOrgId, setActive }: WorkspaceSelectorProps) => {
  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Seus workspaces</p>
      <div className="flex flex-wrap gap-2">
        {orgs.map((m) => (
          <button
            key={m.organization_id}
            onClick={() => setActive(m.organization_id)}
            className={`px-3 py-2 rounded-lg border text-sm transition-all ${
              activeOrgId === m.organization_id
                ? "bg-primary/15 border-primary/40 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.15)]"
                : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
            }`}
          >
            <div className="flex items-center gap-2">
              {activeOrgId === m.organization_id && <Check className="h-3.5 w-3.5 text-primary" />}
              <span className="font-medium">{m.organizations.name}</span>
              <Badge variant="outline" className={`text-[9px] ${ROLE_COLOR[m.role as AppRole]}`}>
                {ROLE_LABEL[m.role as AppRole]}
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
