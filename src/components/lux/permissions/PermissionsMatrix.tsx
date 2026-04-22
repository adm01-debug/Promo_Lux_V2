import { Check, X, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ACTIONS, ACTION_LABEL, ENTITIES, ENTITY_LABEL, ROLES, ROLE_DESCRIPTION, ROLE_LABEL,
  PERMISSION_MATRIX, type AppRole,
} from "@/lib/permissions";

interface Props {
  /** Highlight the current user's role column. */
  currentRole?: AppRole | null;
}

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

export const PermissionsMatrix = ({ currentRole }: Props) => {
  return (
    <div className="space-y-4">
      {/* Role legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {ROLES.map((r) => (
          <div
            key={r}
            className={`rounded-lg border p-3 transition-all ${
              currentRole === r ? "border-primary/50 bg-primary/5" : "border-border/40 bg-secondary/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[r]}`}>{ROLE_LABEL[r]}</Badge>
              {currentRole === r && (
                <span className="text-[9px] uppercase tracking-widest text-primary flex items-center gap-1">
                  <Shield className="h-3 w-3" /> você
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                  Entidade
                </th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-3 py-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-1">
                      <span>{ACTION_LABEL[a]}</span>
                      <div className="flex gap-1">
                        {ROLES.map((r) => (
                          <span
                            key={r}
                            title={ROLE_LABEL[r]}
                            className={`text-[8px] px-1 rounded ${
                              currentRole === r ? "bg-primary/20 text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {ROLE_LABEL[r][0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {ENTITIES.map((e) => (
                <tr key={e} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground text-xs">{ENTITY_LABEL[e]}</td>
                  {ACTIONS.map((a) => {
                    const allowed = PERMISSION_MATRIX[e][a];
                    return (
                      <td key={a} className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {ROLES.map((r) => {
                            const ok = allowed.includes(r);
                            const isMe = currentRole === r;
                            return (
                              <span
                                key={r}
                                title={`${ROLE_LABEL[r]}: ${ok ? "permitido" : "bloqueado"}`}
                                className={`h-5 w-5 rounded flex items-center justify-center text-[10px] ${
                                  ok
                                    ? isMe
                                      ? "bg-primary/25 text-primary ring-1 ring-primary/40"
                                      : "bg-success/15 text-success"
                                    : isMe
                                      ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                                      : "bg-muted/30 text-muted-foreground/50"
                                }`}
                              >
                                {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        As permissões são aplicadas no backend via RLS. Esta matriz é o reflexo das regras vigentes.
      </p>
    </div>
  );
};