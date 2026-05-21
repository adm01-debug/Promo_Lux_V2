import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(): { full: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const full = `lux_${hex}`;
  return { full, prefix: full.slice(0, 11) }; // "lux_" + 7 chars
}

export function useApiKeys() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["api_keys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("api_keys")
        .select("id,name,prefix,scopes,last_used_at,expires_at,active,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiKey[];
    },
  });

  const createKey = useMutation({
    mutationFn: async (input: { name: string; scopes: string[]; expires_at?: string | null }) => {
      const { full, prefix } = generateKey();
      const key_hash = await sha256Hex(full);
      const { error } = await db.from("api_keys").insert({
        name: input.name,
        prefix,
        key_hash,
        scopes: input.scopes,
        expires_at: input.expires_at ?? null,
      });
      if (error) throw error;
      return { full };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api_keys", user?.id] }),
    onError: (e: Error) => toast.error("Erro ao criar chave", { description: e.message }),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("api_keys").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api_keys", user?.id] });
      toast.success("Chave revogada");
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api_keys", user?.id] });
      toast.success("Chave excluída");
    },
  });

  return { ...query, createKey, revokeKey, deleteKey };
}