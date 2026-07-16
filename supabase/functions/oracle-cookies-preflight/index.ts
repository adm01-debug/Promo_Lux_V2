// ============================================================================
// oracle-cookies-preflight
// Fase 0 — Valida saúde dos 3 cookies (lusha, leadcontact, linkedin) no vault
// self-hosted que a automação externa mantém atualizado. Grava snapshot em
// automation_execution_logs e retorna diagnóstico consolidado.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
];

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

const REQUIRED_SERVICES = ["lusha", "leadcontact", "linkedin"] as const;
type Servico = (typeof REQUIRED_SERVICES)[number];

type VaultRow = {
  servico: string;
  is_healthy: boolean | null;
  health_status: string | null;
  atualizado_em: string | null;
  expires_at: string | null;
  health_error: string | null;
  cookie: string | null;
};

/**
 * Este preflight NÃO chama a API do serviço — ele apenas lê o que o vault
 * declara. Se a sessão morreu no servidor mas o cookie continua bem-formado,
 * este relatório dirá "ready" mesmo assim. A verdade só aparece na primeira
 * chamada real (que hoje registra o 401 de volta no vault via
 * markCookieUnhealthy). Aconteceu em 16/07/2026 com o LeadContact.
 */
type ServiceReport = {
  servico: Servico;
  present: boolean;
  ready: boolean;
  health_status: string | null;
  expires_in_minutes: number | null;
  updated_minutes_ago: number | null;
  error: string | null;
  verificado_de_verdade: false;
};

async function fetchVault(): Promise<VaultRow[]> {
  const externalUrl = Deno.env.get("SUPABASE_EXTERNAL_URL") ?? "https://supabase.atomicabr.com.br";
  const externalKey = Deno.env.get("EXTERNAL_VAULT_ANON_KEY") ?? Deno.env.get("SUPABASE_EXTERNAL_ANON_KEY");
  if (!externalKey) throw new Error("SUPABASE_EXTERNAL_ANON_KEY ausente");

  const url =
    `${externalUrl}/rest/v1/cookies_config` +
    `?servico=in.(lusha,leadcontact,linkedin)` +
    `&select=servico,is_healthy,health_status,atualizado_em,expires_at,health_error,cookie`;

  // Retry 3x: 1s → 3s → 9s
  const delays = [1000, 3000, 9000];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { apikey: externalKey, Authorization: `Bearer ${externalKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`vault HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as VaultRow[];
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw new Error(`CookieVaultUnavailable após 3 tentativas: ${(lastErr as Error).message}`);
}

function buildReport(rows: VaultRow[]): ServiceReport[] {
  const byService = new Map(rows.map((r) => [r.servico, r]));
  const now = Date.now();
  return REQUIRED_SERVICES.map<ServiceReport>((servico) => {
    const row = byService.get(servico);
    if (!row) {
      return {
        servico,
        present: false,
        ready: false,
        health_status: null,
        expires_in_minutes: null,
        updated_minutes_ago: null,
        error: "não encontrado no vault",
        verificado_de_verdade: false,
      };
    }
    const expiresInMin = row.expires_at
      ? Math.floor((new Date(row.expires_at).getTime() - now) / 60_000)
      : null;
    const updatedMinAgo = row.atualizado_em
      ? Math.floor((now - new Date(row.atualizado_em).getTime()) / 60_000)
      : null;
    const hasCookie = !!row.cookie && row.cookie.length > 10;
    const notExpired = expiresInMin === null || expiresInMin > 0;
    const healthyFlag = row.is_healthy !== false && row.health_status !== "expired" && row.health_status !== "error";
    const ready = hasCookie && notExpired && healthyFlag;
    return {
      servico,
      present: true,
      ready,
      health_status: row.health_status,
      expires_in_minutes: expiresInMin,
      updated_minutes_ago: updatedMinAgo,
      error: ready ? null : row.health_error ?? (!hasCookie ? "cookie vazio" : !notExpired ? "expirado" : "unhealthy"),
      verificado_de_verdade: false,
    };
  });
}

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const rows = await fetchVault();
    const report = buildReport(rows);
    const allReady = report.every((r) => r.ready);
    const durationMs = Date.now() - startedAt;

    await admin.from("automation_execution_logs").insert({
      user_id: userData.user.id,
      source: "oracle-cookies-preflight",
      step_name: "vault_check",
      phase: "preflight",
      status: allReady ? "success" : "degraded",
      level: allReady ? "info" : "warn",
      message: allReady
        ? "Vault OK: 3 serviços prontos"
        : `Vault com problemas: ${report.filter((r) => !r.ready).map((r) => r.servico).join(", ")}`,
      duration_ms: durationMs,
      correlation_id: correlationId,
      metadata: { report },
    });

    return new Response(
      JSON.stringify({
        ok: allReady,
        correlation_id: correlationId,
        duration_ms: durationMs,
        services: report,
      }),
      {
        status: allReady ? 200 : 503,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = (err as Error).message ?? "erro desconhecido";
    await admin.from("automation_execution_logs").insert({
      user_id: userData.user.id,
      source: "oracle-cookies-preflight",
      step_name: "vault_check",
      phase: "preflight",
      status: "error",
      level: "error",
      message: "Falha ao consultar vault",
      error_detail: message,
      transient: true,
      duration_ms: Date.now() - startedAt,
      correlation_id: correlationId,
    });
    return new Response(
      JSON.stringify({ ok: false, error: "vault_unavailable", detail: message, correlation_id: correlationId }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
