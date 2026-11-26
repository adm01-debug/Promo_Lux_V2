import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { toast } from "sonner";
import { ENTITIES, ROLES, type AppRole, type Entity } from "@/lib/permissions";

export interface RolePermissionRow {
  id: string;
  organization_id: string;
  role: AppRole;
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
}

export type PermissionFlag = "can_view" | "can_create" | "can_update" | "can_delete" | "can_manage";

const SELECT =
  "id,organization_id,role,resource,can_view,can_create,can_update,can_delete,can_manage";

/**
 * Matriz de permissões persistida no banco (`public.role_permissions`).
 *
 * Substitui a leitura do mapa estático de `src/lib/permissions.ts` na UI: o
 * admin da organização pode ajustar o que cada papel vê/faz em cada recurso.
 * A migration semeia exatamente a matriz do TS, então o comportamento padrão
 * não muda para quem nunca editou nada.
 */
export function useRolePermissions() {
  const { activeOrgId } = useActiveOrganization();
  const qc = useQueryClient();
  const key = ["role_permissions", activeOrgId];

  const query = useQuery({
    queryKey: key,
    enabled: !!activeOrgId,
    // Dado de segurança: no padrão global (2 min, src/App.tsx:51) tirar o
    // acesso de alguém levava até 2 min para aparecer na tela. Só as consultas
    // de papel/permissão usam janela curta e nova busca ao focar a janela.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select(SELECT)
        .eq("organization_id", activeOrgId!)
        .order("resource");
      if (error) throw error;
      return (data ?? []) as RolePermissionRow[];
    },
  });

  /** Mapa `recurso → papel → linha`, para lookup O(1) na renderização da grade. */
  const byKey = new Map<string, RolePermissionRow>();
  for (const row of query.data ?? []) byKey.set(`${row.resource}|${row.role}`, row);

  const toggle = useMutation({
    mutationFn: async (input: {
      resource: Entity; role: AppRole; flag: PermissionFlag; value: boolean;
    }) => {
      const { error } = await supabase
        .from("role_permissions")
        .update({ [input.flag]: input.value } as never)
        .eq("organization_id", activeOrgId!)
        .eq("resource", input.resource)
        .eq("role", input.role);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RolePermissionRow[]>(key);
      qc.setQueryData<RolePermissionRow[]>(key, (old) =>
        (old ?? []).map((r) =>
          r.resource === input.resource && r.role === input.role
            ? { ...r, [input.flag]: input.value }
            : r,
        ),
      );
      return { previous };
    },
    onError: (e: Error, _input, ctx) => {
      // Desfaz a alteração otimista: a matriz não pode divergir do banco.
      // PADRAO DE REFERENCIA para toda atualizacao otimista do repositorio:
      // guardar o valor anterior no onMutate e devolve-lo aqui quando a
      // gravacao falha (mesmo padrao em src/hooks/useDeals.ts). Sem isto a
      // tela mostra uma permissao que o banco recusou. Coberto por
      // src/hooks/__tests__/useRolePermissions.test.tsx.
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error("Erro ao salvar permissão", { description: e.message });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const resetToDefault = useMutation({
    mutationFn: async () => {
      // Restaura o padrão reconstruindo a partir da função do banco, que é a
      // cópia canônica da matriz em src/lib/permissions.ts.
      const { data, error: rpcErr } = await supabase
        .rpc("default_role_permissions" as never);
      if (rpcErr) throw rpcErr;
      const defaults = (data ?? []) as Array<{
        resource: string; role: AppRole; can_view: boolean; can_create: boolean;
        can_update: boolean; can_delete: boolean; can_manage: boolean;
      }>;
      if (!defaults.length) throw new Error("Padrão indisponível");

      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          defaults.map((d) => ({ ...d, organization_id: activeOrgId! })) as never,
          { onConflict: "organization_id,role,resource" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Permissões restauradas ao padrão");
    },
    onError: (e: Error) => toast.error("Erro ao restaurar", { description: e.message }),
  });

  return { ...query, byKey, toggle, resetToDefault };
}

/** Recursos gerenciáveis, na ordem exibida na matriz. */
export const MANAGED_ENTITIES: Entity[] = ENTITIES;
export const MANAGED_ROLES: AppRole[] = ROLES;