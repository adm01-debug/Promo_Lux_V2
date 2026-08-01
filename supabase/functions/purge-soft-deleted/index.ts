import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Expurga permanentemente registros na lixeira há mais de 30 dias (ADR-008).
 * Executado por cron (pg_cron → pg_net). Usa service role para chamar a
 * função SECURITY DEFINER `purge_soft_deleted`, que não é exposta a usuários.
 *
 * Sem CORS: função server-to-server (cron), nunca chamada de browser — CORS
 * não se aplica. `npm:@supabase/supabase-js@2/cors` (import original) nem
 * existe como subpath do pacote — a função nunca carregava.
 */
Deno.serve(async (req) => {
  // Gate por bearer do service role (mesmo padrão de audit-logs-prune): sem
  // isso, qualquer requisição não-autenticada na URL pública desta função
  // dispara uma exclusão permanente e irreversível de dados de todos os
  // usuários — a função não tinha NENHUMA checagem de autenticação.
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.rpc("purge_soft_deleted");
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, purged_at: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
