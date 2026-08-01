/**
 * Vault Cookie Health
 * ============================================================
 * Executada diariamente (cron 09:00 UTC) ou manualmente por admin.
 * Fluxo:
 *   1. Consulta o vault self-hosted em `cookies_config` via anon key.
 *   2. Persiste um snapshot por serviço (lusha/leadcontact/linkedin).
 *   3. Avalia regras de alerta (RPC) que criam notificações para admins.
 *
 * Retorna contadores agregados — sem valores de cookies.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Servico = "lusha" | "leadcontact" | "linkedin";
const SERVICES: Servico[] = ["lusha", "leadcontact", "linkedin"];

interface VaultRow {
  servico: Servico;
  is_healthy: boolean | null;
  health_status: string | null;
  expires_at: string | null;
}

interface SnapshotPayload {
  servico: Servico;
  is_healthy: boolean | null;
  health_status: string | null;
  expires_at: string | null;
  vault_available: boolean;
  error_message: string | null;
}

function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    function: "vault-cookie-health",
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

async function fetchVault(requestId: string): Promise<
  { available: true; rows: VaultRow[] } | { available: false; error: string }
> {
  const externalUrl =
    Deno.env.get("SUPABASE_EXTERNAL_URL") ?? "https://supabase.atomicabr.com.br";
  const externalKey =
    Deno.env.get("EXTERNAL_VAULT_ANON_KEY") ??
    Deno.env.get("SUPABASE_EXTERNAL_ANON_KEY");

  if (!externalKey) {
    return { available: false, error: "EXTERNAL_VAULT_ANON_KEY ausente" };
  }

  const url =
    `${externalUrl}/rest/v1/cookies_config` +
    `?servico=in.(lusha,leadcontact,linkedin)` +
    `&select=servico,is_healthy,health_status,expires_at`;

  try {
    const res = await fetch(url, {
      headers: { apikey: externalKey, Authorization: `Bearer ${externalKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      const err = `vault HTTP ${res.status}: ${body.slice(0, 200)}`;
      log("error", "vault_http_error", { request_id: requestId, status: res.status });
      return { available: false, error: err };
    }
    const rows = (await res.json()) as VaultRow[];
    return { available: true, rows };
  } catch (err) {
    const msg = (err as Error)?.message ?? "erro desconhecido";
    log("error", "vault_fetch_failed", { request_id: requestId, error: msg });
    return { available: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    log("error", "missing_env", { request_id: requestId });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Fetch vault
  const vault = await fetchVault(requestId);

  // 2. Monta payload de snapshots
  let snapshots: SnapshotPayload[];
  if (vault.available) {
    const byServico = new Map<Servico, VaultRow>();
    for (const r of vault.rows) {
      if (SERVICES.includes(r.servico)) byServico.set(r.servico, r);
    }
    snapshots = SERVICES.map((s) => {
      const r = byServico.get(s);
      if (!r) {
        return {
          servico: s,
          is_healthy: null,
          health_status: null,
          expires_at: null,
          vault_available: false,
          error_message: "servico_ausente_no_vault",
        };
      }
      return {
        servico: s,
        is_healthy: r.is_healthy,
        health_status: r.health_status,
        expires_at: r.expires_at,
        vault_available: true,
        error_message: null,
      };
    });
  } else {
    snapshots = SERVICES.map((s) => ({
      servico: s,
      is_healthy: null,
      health_status: null,
      expires_at: null,
      vault_available: false,
      error_message: vault.error,
    }));
  }

  // 3. Persistir snapshots
  const { data: inserted, error: recErr } = await admin.rpc(
    "record_vault_cookie_snapshots",
    {
      _payload: snapshots.map((s) => ({
        servico: s.servico,
        is_healthy: s.is_healthy === null ? "" : String(s.is_healthy),
        health_status: s.health_status ?? "",
        expires_at: s.expires_at ?? "",
        vault_available: String(s.vault_available),
        error_message: s.error_message ?? "",
      })),
    },
  );
  if (recErr) {
    log("error", "record_failed", { request_id: requestId, error: recErr.message });
    return new Response(
      JSON.stringify({ error: "record_snapshots_failed", details: recErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 4. Avaliar e disparar alertas
  const { data: triggered, error: evalErr } = await admin.rpc(
    "evaluate_vault_cookie_alerts",
  );
  if (evalErr) {
    log("error", "evaluate_failed", { request_id: requestId, error: evalErr.message });
    return new Response(
      JSON.stringify({ error: "evaluate_alerts_failed", details: evalErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const durationMs = Date.now() - startedAt;
  log("info", "done", {
    request_id: requestId,
    vault_available: vault.available,
    snapshots_recorded: inserted ?? 0,
    alerts_triggered: triggered ?? 0,
    duration_ms: durationMs,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      request_id: requestId,
      vault_available: vault.available,
      snapshots_recorded: inserted ?? 0,
      alerts_triggered: triggered ?? 0,
      duration_ms: durationMs,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
