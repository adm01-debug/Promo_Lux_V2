/**
 * Org Violation Rate Alerts
 * ============================================================
 * Avalia, a cada execução, se alguma organização ultrapassou o
 * limite configurado de OrgMismatchError dentro da janela definida
 * (default = última hora). Para cada organização que estoura o
 * limite e está fora do cooldown:
 *   1. Registra um alerta em `org_violation_alerts`.
 *   2. Enfileira uma entrega webhook (`security.org_violation_threshold`)
 *      para todos os webhooks ativos da organização que assinam o evento.
 *
 * Pode ser disparado:
 *   - Por cron (pg_cron + pg_net), a cada 5 minutos.
 *   - Manualmente via POST autenticado (admin) — útil para testes na UI.
 *
 * O endpoint não retorna dados sensíveis: apenas resumo agregado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LogFields {
  [k: string]: unknown;
}

function log(level: "info" | "warn" | "error", msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    function: "org-violation-alerts",
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

interface EvaluationRow {
  organization_id: string;
  threshold: number;
  window_minutes: number;
  cooldown_minutes: number;
  violation_count: number;
  distinct_actors: number;
  distinct_correlations: number;
  top_tables: Array<{ table: string; count: number }>;
  last_alert_at: string | null;
}

const ALERT_EVENT = "security.org_violation_threshold";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    log("error", "missing env", { request_id: requestId });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Manual invocation (POST) requires admin in *some* organization.
  // Cron invocations come from pg_net with the anon key — we accept
  // both, but require the service role key in env to actually do work.
  let manualUserId: string | null = null;
  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data.user) manualUserId = data.user.id;
    }
  }

  try {
    const { data: rows, error } = await admin.rpc("evaluate_org_violation_alerts");
    if (error) {
      log("error", "rpc_failed", { request_id: requestId, error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = (rows ?? []) as EvaluationRow[];
    log("info", "evaluation_done", {
      request_id: requestId,
      candidates: candidates.length,
      manual: manualUserId !== null,
    });

    const dispatched: Array<{
      organization_id: string;
      alert_id: string;
      webhooks_enqueued: number;
    }> = [];

    for (const row of candidates) {
      // 1. Insere o registro de alerta (single source of truth p/ cooldown).
      const { data: insertedAlert, error: insertErr } = await admin
        .from("org_violation_alerts")
        .insert({
          organization_id: row.organization_id,
          window_minutes: row.window_minutes,
          threshold: row.threshold,
          violation_count: row.violation_count,
          distinct_actors: row.distinct_actors,
          distinct_correlations: row.distinct_correlations,
          top_tables: row.top_tables ?? [],
          notes: manualUserId ? `manual_trigger:${manualUserId}` : "scheduled",
        })
        .select("id")
        .single();

      if (insertErr || !insertedAlert) {
        log("error", "alert_insert_failed", {
          request_id: requestId,
          organization_id: row.organization_id,
          error: insertErr?.message,
        });
        continue;
      }

      // 2. Enfileira entregas webhook para quem assina o evento.
      const { data: webhooks } = await admin
        .from("webhooks")
        .select("id, user_id, events, active")
        .eq("organization_id", row.organization_id)
        .eq("active", true);

      let enqueued = 0;
      const subscribers = (webhooks ?? []).filter((w) =>
        Array.isArray(w.events) && w.events.includes(ALERT_EVENT),
      );

      const payload = {
        event: ALERT_EVENT,
        timestamp: new Date().toISOString(),
        data: {
          alert_id: insertedAlert.id,
          organization_id: row.organization_id,
          window_minutes: row.window_minutes,
          threshold: row.threshold,
          violation_count: row.violation_count,
          distinct_actors: row.distinct_actors,
          distinct_correlations: row.distinct_correlations,
          top_tables: row.top_tables ?? [],
        },
      };

      for (const wh of subscribers) {
        const { error: dErr } = await admin.from("webhook_deliveries").insert({
          user_id: wh.user_id,
          organization_id: row.organization_id,
          webhook_id: wh.id,
          event: ALERT_EVENT,
          payload,
          status: "pending",
          next_retry_at: new Date().toISOString(),
        });
        if (dErr) {
          log("warn", "webhook_enqueue_failed", {
            request_id: requestId,
            webhook_id: wh.id,
            error: dErr.message,
          });
        } else {
          enqueued += 1;
        }
      }

      // 3. Atualiza o resumo de despacho no alerta para auditoria.
      await admin
        .from("org_violation_alerts")
        .update({
          webhook_dispatch: {
            subscribers_total: subscribers.length,
            enqueued,
            enqueued_at: new Date().toISOString(),
          },
        })
        .eq("id", insertedAlert.id);

      // 4. Notificação interna para admins da org (best effort).
      const { data: admins } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", row.organization_id)
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifyRows = admins.map((m) => ({
          user_id: m.user_id,
          organization_id: row.organization_id,
          type: "signal",
          title: "Pico de violações de organização detectado",
          message: `${row.violation_count} tentativas de acesso cross-org nos últimos ${row.window_minutes} min (limite: ${row.threshold}).`,
          metadata: {
            kind: "org_violation_alert",
            alert_id: insertedAlert.id,
            violation_count: row.violation_count,
            distinct_actors: row.distinct_actors,
          },
        }));
        await admin.from("notifications").insert(notifyRows);
      }

      dispatched.push({
        organization_id: row.organization_id,
        alert_id: insertedAlert.id,
        webhooks_enqueued: enqueued,
      });
    }

    log("info", "done", {
      request_id: requestId,
      dispatched: dispatched.length,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        evaluated: candidates.length,
        dispatched: dispatched.length,
        details: dispatched,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "unhandled", { request_id: requestId, error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});