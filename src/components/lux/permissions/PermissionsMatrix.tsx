import { useState } from "react";
import { Check, X, Shield, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACTIONS, ACTION_LABEL, ENTITIES, ENTITY_LABEL, ROLES, ROLE_DESCRIPTION, ROLE_LABEL,
  PERMISSION_MATRIX, type Action, type AppRole, type Entity,
} from "@/lib/permissions";
import { useRolePermissions, type PermissionFlag } from "@/hooks/useRolePermissions";

interface Props {
  /** Highlight the current user's role column. */
  currentRole?: AppRole | null;
  /** Habilita a edição (somente admin da organização). */
  editable?: boolean;
}

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

const FLAG: Record<Action, PermissionFlag> = {
  view: "can_view",
  create: "can_create",
  edit: "can_update",
  delete: "can_delete",
  manage: "can_manage",
};

export const PermissionsMatrix = ({ currentRole, editable = false }: Props) => {
  const { byKey, toggle, resetToDefault, isLoading } = useRolePermissions();
  const [selectedRole, setSelectedRole] = useState<AppRole>(currentRole ?? "sdr");

  /** Valor efetivo da célula: banco quando existe, senão o padrão do TS. */
  const valueFor = (entity: Entity, action: Action, role: AppRole): boolean => {
    const row = byKey.get(`${entity}|${role}`);
    if (row) return row[FLAG[action]];
    return PERMISSION_MATRIX[entity][action].includes(role);
  };

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

      {editable && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Editando o papel:</span>
            {ROLES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={selectedRole === r ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setSelectedRole(r)}
              >
                {ROLE_LABEL[r]}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5 text-muted-foreground"
            onClick={() => resetToDefault.mutate()}
            disabled={resetToDefault.isPending || isLoading}
          >
            {resetToDefault.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RotateCcw className="h-3.5 w-3.5" />}
            Restaurar padrão
          </Button>
        </div>
      )}

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
                      {!editable && (
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
                      )}
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
                    if (editable) {
                      const active = valueFor(e, a, selectedRole);
                      return (
                        <td key={a} className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              toggle.mutate({ resource: e, role: selectedRole, flag: FLAG[a], value: !active })
                            }
                            aria-label={`${ENTITY_LABEL[e]} · ${ACTION_LABEL[a]} · ${ROLE_LABEL[selectedRole]}: ${active ? "permitido" : "bloqueado"}`}
                            aria-pressed={active}
                            className={`h-6 w-6 mx-auto rounded flex items-center justify-center transition-colors ${
                              active
                                ? "bg-success/15 text-success hover:bg-success/25"
                                : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50"
                            }`}
                          >
                            {active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    }
                    const allowed = PERMISSION_MATRIX[e][a];
                    return (
                      <td key={a} className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {ROLES.map((r) => {
                            const ok = valueFor(e, a, r);
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
        {editable
          ? "As alterações valem para todos os membros deste papel na organização. A RLS continua aplicando o isolamento de dados."
          : "As permissões são aplicadas no backend via RLS. Esta matriz é o reflexo das regras vigentes."}
      </p>
    </div>
  );
};