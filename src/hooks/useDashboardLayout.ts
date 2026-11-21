import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { getActiveOrgId } from "@/integrations/supabase/withOrg";
import { toast } from "sonner";

const LAYOUT_KEY = "lux-dashboard-widget-order";
const DASHBOARD_KEY = "default";

export interface DashboardWidget {
  id: string;
  visible?: boolean;
}

/** Lê o layout legado do localStorage (usado como cache e como fallback). */
function readLocal(): DashboardWidget[] | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(widgets: DashboardWidget[]) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(widgets));
  } catch {
    /* quota/privado: o banco continua sendo a fonte de verdade */
  }
}

/**
 * Layout do dashboard por usuário.
 *
 * Fonte de verdade = public.dashboard_layouts (por usuário, não por navegador).
 * O localStorage continua servindo de cache síncrono no primeiro render, então
 * quem já tinha ordem salva não vê o dashboard "pular" enquanto a query carrega.
 * Usuário novo/offline cai na ordem padrão do componente.
 */
export function useDashboardLayout<T extends string>(defaultOrder: T[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = getActiveOrgId();

  // Estado inicial síncrono: evita flash de ordem padrão no primeiro paint.
  const [order, setOrder] = useState<T[]>(() => {
    const local = readLocal();
    if (!local) return defaultOrder;
    const ids = local.map((w) => w.id).filter((id): id is T => (defaultOrder as string[]).includes(id));
    // preserva widgets novos que ainda não estavam no layout salvo
    const missing = defaultOrder.filter((d) => !ids.includes(d));
    return [...ids, ...missing];
  });

  const query = useQuery({
    queryKey: ["dashboard_layout", user?.id, orgId, DASHBOARD_KEY],
    enabled: !!user,
    // layout muda por ação do usuário, não por outro cliente: sem polling
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("widgets")
        .eq("user_id", user!.id)
        .eq("dashboard_key", DASHBOARD_KEY)
        .maybeSingle();
      if (error) throw error;
      return data?.widgets as DashboardWidget[] | null ?? null;
    },
  });

  // Reconcilia banco -> tela assim que a query responde.
  useEffect(() => {
    if (!query.data) return;
    const ids = query.data.map((w) => w.id).filter((id): id is T => (defaultOrder as string[]).includes(id));
    const missing = defaultOrder.filter((d) => !ids.includes(d));
    const next = [...ids, ...missing];
    setOrder(next);
    writeLocal(next.map((id) => ({ id })));
    // defaultOrder é constante de módulo na prática; comparar por conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, defaultOrder.join(",")]);

  const persist = useMutation({
    mutationFn: async (next: T[]) => {
      if (!user) return;
      const { error } = await supabase
        .from("dashboard_layouts")
        .upsert(
          {
            user_id: user.id,
            organization_id: orgId,
            dashboard_key: DASHBOARD_KEY,
            widgets: next.map((id) => ({ id })) as unknown as never,
          },
          { onConflict: "user_id,organization_id,dashboard_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard_layout", user?.id, orgId, DASHBOARD_KEY] });
    },
    onError: (err: Error) => {
      // Layout é conforto, não dado crítico: avisa e mantém o cache local.
      toast.error("Não foi possível salvar o layout no servidor", {
        description: "A ordem continua salva neste navegador.",
      });
      void err;
    },
  });

  const saveOrder = useCallback(
    (next: T[]) => {
      setOrder(next);
      writeLocal(next.map((id) => ({ id })));
      persist.mutate(next);
    },
    [persist],
  );

  const resetOrder = useCallback(() => {
    saveOrder(defaultOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveOrder]);

  return {
    order,
    saveOrder,
    resetOrder,
    isLoading: query.isLoading,
    isSaving: persist.isPending,
    isPersisted: !!query.data,
  };
}