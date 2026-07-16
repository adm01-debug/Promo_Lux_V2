// ============================================================================
// _shared/safe-update.ts
// Update em lusha_contacts que NUNCA falha em silêncio.
//
// Motivo: a tabela tem 4 colunas GENERATED e 6 CHECKs. Um `.update()` sem
// checar o retorno transforma 428C9/23514 em nada — o contato trava no status
// anterior e ninguém fica sabendo. Foi assim que um bug de persistência
// sobreviveu semanas em produção.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OracleLogger } from "./oracle-logger.ts";

export async function updateContact(
  admin: SupabaseClient,
  logger: OracleLogger,
  contactId: string,
  updates: Record<string, unknown>,
  step: string,
): Promise<boolean> {
  const { error } = await admin.from("lusha_contacts").update(updates).eq("id", contactId);
  if (error) {
    await logger.log({
      step,
      status: "error",
      level: "error",
      message: `falha ao gravar em lusha_contacts (${step})`,
      errorDetail: error.message,
      metadata: {
        contact_id: contactId,
        campos: Object.keys(updates),
        code: (error as { code?: string }).code ?? null,
      },
    });
    return false;
  }
  return true;
}
