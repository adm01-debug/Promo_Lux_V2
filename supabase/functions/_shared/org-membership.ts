// ============================================================================
// _shared/org-membership.ts
// Funções service_role (admin client) ignoram RLS por definição. Toda função
// que recebe IDs de linhas org-scoped (contact_ids, organization_id, etc.) do
// corpo da requisição PRECISA revalidar que o chamador pertence à organização
// dona daqueles dados antes de ler/escrever — senão o service_role vira um
// bypass de tenant isolation. Use estas funções nesse ponto de checagem.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Retorna o conjunto de organization_id dos quais userId é membro. */
export async function getUserOrgIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  if (error || !data) return [];
  return [...new Set(data.map((r) => (r as { organization_id: string }).organization_id))];
}

/** Verifica se userId é membro de uma organization_id específica. */
export async function isUserOrgMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !error && !!data;
}
