// SLA Auto-Tune — cron diário.
// Executa `auto_tune_queue_slas()` para reajustar o SLA padrão de enfileiramento
// de cada fila (scrape/web/instagram) quando o desvio entre o prazo configurado
// e a recomendação (p95 × 1,3) ultrapassa a tolerância. Filas com `auto_tune=false`
// são ignoradas. Toda alteração é registrada em `queue_sla_history` pelo trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TuneRow {
  queue_kind: string;
  old_sla_seconds: number;
  new_sla_seconds: number;
  applied: boolean;
  reason: string | null;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const authorized =
    (serviceKey && (bearer === serviceKey || apiKeyHeader === serviceKey)) ||
    (anonKey && (bearer === anonKey || apiKeyHeader === anonKey));
  if (!authorized) return json(401, { ok: false, error: "unauthorized" });

  const correlationId = crypto.randomUUID();

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const hours = clampInt(body.hours, 1, 720, 168);
    const minDriftPct = clampInt(body.min_drift_pct, 1, 100, 20);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data, error } = await supa.rpc("auto_tune_queue_slas", {
      p_hours: hours,
      p_min_drift_pct: minDriftPct,
    });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as TuneRow[];
    const applied = rows.filter((r) => r.applied);

    // Notifica administradores apenas quando houve reajuste efetivo.
    if (applied.length > 0) {
      const { data: admins } = await supa
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const summary = applied
        .map((r) => `${r.queue_kind}: ${r.old_sla_seconds}s → ${r.new_sla_seconds}s`)
        .join(" · ");

      const uniqueUsers = Array.from(
        new Set((admins ?? []).map((a: { user_id: string }) => a.user_id)),
      );

      for (const userId of uniqueUsers) {
        // `organization_id` é NOT NULL e seu default depende de auth.uid(),
        // que é nulo no contexto service_role — resolvemos explicitamente.
        const { data: membership } = await supa
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!membership?.organization_id) continue;

        await supa.from("notifications").insert({
          user_id: userId,
          organization_id: membership.organization_id,
          type: "system",
          title: "SLA padrão reajustado automaticamente",
          message: summary,
          metadata: { source: "sla-auto-tune", correlation_id: correlationId, changes: applied },
        });
      }
    }

    }

    return json(200, {
      ok: true,
      correlation_id: correlationId,
      hours,
      min_drift_pct: minDriftPct,
      applied_count: applied.length,
      results: rows,
    });
  } catch (err) {
    console.error("[sla-auto-tune] failure", correlationId, err);
    return json(500, {
      ok: false,
      correlation_id: correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
