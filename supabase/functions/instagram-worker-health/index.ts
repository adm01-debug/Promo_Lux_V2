/**
 * instagram-worker-health — status operacional do motor Instagram.
 *
 * Retorna:
 *  - apify_mock_mode: se o modo mock está ativo
 *  - fault_config:    APIFY_MOCK_FAULTS parseado (por actor / wildcard)
 *  - counters:        runs iniciadas/sucesso/falha, datasets/items servidos, faults injetados
 *  - by_actor:        agregados por actorId
 *  - by_fault:        agregados por tipo de falha
 *  - last_errors:     últimos 20 erros do mock (stage, actor, kind, mensagem)
 *  - queue:           snapshot da fila (queued/running/succeeded/failed/dead) por status
 *  - recent_dlq:      últimos 10 registros do dead-letter
 *
 * IMPORTANTE: os counters do mock são in-memory por instância de Edge Function.
 * Runtime recicla o isolate periodicamente — trate como métricas do "último ciclo".
 * Autenticação: requer service_role (rota administrativa).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getMockStats } from "../_shared/apify-gateway.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isServiceRole(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === SERVICE_ROLE;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  if (!isServiceRole(req.headers.get("authorization"))) {
    return json(401, { error: "unauthorized", hint: "service_role required" });
  }

  const mock = getMockStats();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Snapshot da fila por status (últimas 24h para nao carregar tudo)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: queueRows, error: qErr } = await admin
    .from("instagram_scrape_queue")
    .select("status")
    .gte("created_at", since);

  const queueByStatus: Record<string, number> = {};
  if (!qErr && queueRows) {
    for (const row of queueRows) {
      const s = (row as { status: string }).status;
      queueByStatus[s] = (queueByStatus[s] ?? 0) + 1;
    }
  }

  const { data: dlq } = await admin
    .from("instagram_scrape_dead_letter")
    .select("id, target_type, target_value, error_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return json(200, {
    ok: true,
    timestamp: new Date().toISOString(),
    apify_mock_mode: mock.mock_mode,
    fault_config: mock.fault_config,
    counters: mock.counters,
    by_actor: mock.by_actor,
    by_fault: mock.by_fault,
    last_errors: mock.last_errors,
    queue: {
      window_hours: 24,
      by_status: queueByStatus,
      total: queueRows?.length ?? 0,
      error: qErr?.message ?? null,
    },
    recent_dlq: dlq ?? [],
  });
});
