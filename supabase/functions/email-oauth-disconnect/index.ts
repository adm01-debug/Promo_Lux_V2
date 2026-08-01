// Desconecta uma caixa de email: revoga tokens no provedor (best-effort),
// remove a linha em email_accounts e registra auditoria detalhada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: cErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { account_id, revoke = true } = await req.json();
    if (!account_id || typeof account_id !== "string") {
      return json({ error: "account_id required" }, 400);
    }

    // Service role para garantir leitura mesmo se RLS de UPDATE for restritiva
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: account, error: fetchErr } = await admin
      .from("email_accounts")
      .select("id, provider, email, scope_type, organization_id, user_id, access_token, refresh_token")
      .eq("id", account_id)
      .maybeSingle();

    if (fetchErr || !account) return json({ error: "Account not found" }, 404);

    // Permissão: dono pode remover a sua própria; org accounts exigem admin
    if (account.scope_type === "organization") {
      const { data: isAdmin } = await userClient.rpc("has_org_role", {
        _org_id: account.organization_id,
        _user_id: userId,
        _min_role: "admin",
      });
      if (!isAdmin) return json({ error: "Apenas admins podem remover caixas compartilhadas" }, 403);
    } else if (account.user_id !== userId) {
      // pessoal: só o dono
      const { data: isAdmin } = await userClient.rpc("has_org_role", {
        _org_id: account.organization_id,
        _user_id: userId,
        _min_role: "admin",
      });
      if (!isAdmin) return json({ error: "Sem permissão" }, 403);
    }

    // Best-effort: revoga tokens no provedor
    const revocation: { attempted: boolean; success: boolean; error: string | null } = {
      attempted: false, success: false, error: null,
    };
    if (revoke && (account.refresh_token || account.access_token)) {
      revocation.attempted = true;
      try {
        if (account.provider === "gmail") {
          // Google: POST https://oauth2.googleapis.com/revoke?token=<token>
          const token = account.refresh_token || account.access_token!;
          const r = await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
          );
          revocation.success = r.ok;
          if (!r.ok) revocation.error = `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
        } else if (account.provider === "outlook") {
          // Microsoft não tem endpoint público de revoke por token via OAuth2;
          // o caminho correto é via Graph API requireing user signin. Marcamos como
          // "no-op" e instruímos invalidação por remoção local.
          revocation.success = false;
          revocation.error = "Microsoft não suporta revoke por token; sessão será invalidada localmente.";
        }
      } catch (e) {
        revocation.error = e instanceof Error ? e.message : "revoke failed";
      }
    }

    // Limpa tokens antes do delete (defensive — caso DELETE falhe parcialmente)
    await admin
      .from("email_accounts")
      .update({ access_token: null, refresh_token: null, active: false, last_error: "disconnected_by_user" })
      .eq("id", account_id);

    // Delete (trigger de audit_logs já registra a remoção via log_audit_event)
    const { error: delErr } = await admin.from("email_accounts").delete().eq("id", account_id);
    if (delErr) return json({ error: delErr.message }, 500);

    // Auditoria adicional com contexto de revogação (além do trigger genérico)
    await admin.from("audit_logs").insert({
      actor_id: userId,
      table_name: "email_accounts",
      record_id: account_id,
      action: "delete",
      organization_id: account.organization_id,
      old_data: {
        email: account.email,
        provider: account.provider,
        scope_type: account.scope_type,
        revocation,
        disconnected_at: new Date().toISOString(),
        reason: "manual_disconnect",
      },
    });

    return json({ ok: true, revocation });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}