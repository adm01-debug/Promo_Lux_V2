import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OAuthSnapshot {
  id: string;
  organization_id: string;
  user_id: string;
  label: string;
  provider: "gmail" | "outlook";
  scope_type: "user" | "organization";
  redirect_uri: string;
  redirect_uri_normalized: string;
  scopes: string[];
  client_id_configured: boolean;
  client_secret_configured: boolean;
  warnings: string[];
  auth_url_preview: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaveSnapshotInput {
  label: string;
  provider: "gmail" | "outlook";
  scope_type: "user" | "organization";
  redirect_uri: string;
  redirect_uri_normalized: string;
  scopes: string[];
  client_id_configured: boolean;
  client_secret_configured: boolean;
  warnings: string[];
  auth_url_preview: string | null;
  notes?: string | null;
}

const KEY = ["oauth_sandbox_snapshots"] as const;

/**
 * Lista snapshots de validação OAuth da organização ativa.
 * Ordenado do mais recente para o mais antigo, limitado a 50 entradas
 * para manter a UI leve.
 */
export function useOAuthSandboxSnapshots() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<OAuthSnapshot[]> => {
      const { data, error } = await supabase
        .from("oauth_sandbox_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as OAuthSnapshot[];
    },
  });
}

export function useSaveOAuthSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveSnapshotInput): Promise<OAuthSnapshot> => {
      const { data, error } = await supabase
        .from("oauth_sandbox_snapshots")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data as OAuthSnapshot;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteOAuthSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oauth_sandbox_snapshots").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Diferença campo a campo entre dois snapshots — usada na visualização de comparação. */
export interface SnapshotDiffEntry {
  field: string;
  label: string;
  changed: boolean;
  left: string | string[] | boolean | null;
  right: string | string[] | boolean | null;
}

export function diffSnapshots(a: OAuthSnapshot, b: OAuthSnapshot): SnapshotDiffEntry[] {
  const eqArr = (x: string[], y: string[]) =>
    x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);

  return [
    { field: "provider", label: "Provedor", changed: a.provider !== b.provider, left: a.provider, right: b.provider },
    { field: "scope_type", label: "Escopo da caixa", changed: a.scope_type !== b.scope_type, left: a.scope_type, right: b.scope_type },
    {
      field: "redirect_uri_normalized",
      label: "Redirect URI",
      changed: a.redirect_uri_normalized !== b.redirect_uri_normalized,
      left: a.redirect_uri_normalized,
      right: b.redirect_uri_normalized,
    },
    {
      field: "scopes",
      label: "Scopes solicitados",
      changed: !eqArr(a.scopes, b.scopes),
      left: a.scopes,
      right: b.scopes,
    },
    {
      field: "client_id_configured",
      label: "Client ID configurado",
      changed: a.client_id_configured !== b.client_id_configured,
      left: a.client_id_configured,
      right: b.client_id_configured,
    },
    {
      field: "client_secret_configured",
      label: "Client Secret configurado",
      changed: a.client_secret_configured !== b.client_secret_configured,
      left: a.client_secret_configured,
      right: b.client_secret_configured,
    },
    {
      field: "warnings",
      label: "Avisos",
      changed: !eqArr(a.warnings, b.warnings),
      left: a.warnings,
      right: b.warnings,
    },
  ];
}