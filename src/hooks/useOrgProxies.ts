import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export interface OrgProxy {
  id: string;
  organization_id: string;
  label: string;
  proxy_type: string;
  url: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProxyInput {
  label: string;
  proxy_type: "http" | "https" | "socks5";
  url: string;
  is_active: boolean;
}

export const useOrgProxies = () => {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["org-proxies", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<OrgProxy[]> => {
      const { data, error } = await supabase
        .from("org_proxies")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrgProxy[];
    },
  });
};

export const useCreateProxy = () => {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (input: ProxyInput) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");
      const { data, error } = await supabase
        .from("org_proxies")
        .insert({ ...input, organization_id: activeOrgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-proxies"] }),
  });
};

export const useUpdateProxy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProxyInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("org_proxies")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-proxies"] }),
  });
};

export const useDeleteProxy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_proxies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-proxies"] }),
  });
};
