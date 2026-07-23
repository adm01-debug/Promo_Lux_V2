// Alertas do Reaper (R40 #2) — cron a cada 30 min.
// Verifica as N execuções mais recentes de `qa_reaper_runs` e dispara alerta se:
//   (a) as últimas `consecutive` execuções tiveram total_dead >= min_dead_per_run; OU
//   (b) não houve execução do reaper nas últimas `no_run_hours` horas.
// Respeita cooldown_hours entre alertas do mesmo motivo.
// Requer service_role no header Authorization (padrão das crons deste projeto).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReaperRun = {
  ran_at: string;
  instagram_dead: number;
  scrape_dead: number;
  web_dead: number;
};

type Settings = {
  enabled: boolean;
  consecutive: number;
  min_dead_per_run: number;
  no_run_hours: number;
  cooldown_hours: number;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data: settingsRow } = await supa
      .from("reaper_alert_settings")
      .select("enabled, consecutive, min_dead_per_run, no_run_hours, cooldown_hours")
      .maybeSingle();

    const s = (settingsRow ?? {
      enabled: true,
      consecutive: 1,
      min_dead_per_run: 1,
      no_run_hours: 2,
      cooldown_hours: 6,
    }) as Settings;

    if (!s.enabled) return json(200, { ok: true, triggered: 0, skipped: "disabled" });

    const { data: runsRaw } = await supa
      .from("qa_reaper_runs")
      .select("ran_at, instagram_dead, scrape_dead, web_dead")
      .order("ran_at", { ascending: false })
      .limit(Math.max(s.consecutive, 1));

    const runs = (runsRaw ?? []) as ReaperRun[];
    const lastRunAt = runs[0]?.ran_at ?? null;
    const now = Date.now();

    const staleMs = s.no_run_hours * 3600_000;
    const isStale =
      !lastRunAt || now - new Date(lastRunAt).getTime() > staleMs;

    const enoughRuns = runs.length >= s.consecutive;
    const allBreach =
      enoughRuns &&
      runs.every(
        (r) =>
          (r.instagram_dead ?? 0) + (r.scrape_dead ?? 0) + (r.web_dead ?? 0) >=
          s.min_dead_per_run,
      );

    const triggered: string[] = [];

    async function fireAlert(
      reason: "dead_detected" | "no_recent_run",
      payload: {
        instagram_dead: number;
        scrape_dead: number;
        web_dead: number;
        details: Record<string, unknown>;
      },
    ) {
      const cooldownMs = s.cooldown_hours * 3600_000;
      const { data: last } = await supa
        .from("reaper_alert_history")
        .select("triggered_at")
        .eq("reason", reason)
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        last &&
        new Date((last as { triggered_at: string }).triggered_at).getTime() >
          now - cooldownMs
      ) {
        return; // cooldown
      }

      await supa.from("reaper_alert_history").insert({
        reason,
        instagram_dead: payload.instagram_dead,
        scrape_dead: payload.scrape_dead,
        web_dead: payload.web_dead,
        consecutive: s.consecutive,
        last_run_at: lastRunAt,
        details: payload.details,
      });

      // Notifica todos os admins de todas as organizações (evento global).
      const { data: admins } = await supa
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const uniqueUsers = Array.from(
        new Set((admins ?? []).map((a: { user_id: string }) => a.user_id)),
      );

      const title =
        reason === "dead_detected"
          ? "Reaper detectou tarefas mortas"
          : "Reaper sem execução recente";
      const message =
        reason === "dead_detected"
          ? `As últimas ${s.consecutive} execuções do reaper enviaram tarefas para a DLQ (IG=${payload.instagram_dead}, scrape=${payload.scrape_dead}, web=${payload.web_dead}).`
          : `O reaper não executa há mais de ${s.no_run_hours}h (última: ${lastRunAt ?? "nunca"}).`;

      for (const user_id of uniqueUsers) {
        await supa.from("notifications").insert({
          user_id,
          type: "system",
          title,
          message,
          metadata: {
            source: "reaper-alerts",
            reason,
            instagram_dead: payload.instagram_dead,
            scrape_dead: payload.scrape_dead,
            web_dead: payload.web_dead,
            last_run_at: lastRunAt,
          },
        });
      }
      triggered.push(reason);
    }

    if (isStale) {
      await fireAlert("no_recent_run", {
        instagram_dead: 0,
        scrape_dead: 0,
        web_dead: 0,
        details: { no_run_hours: s.no_run_hours, last_run_at: lastRunAt },
      });
    } else if (allBreach) {
      const ig = runs.reduce((a, r) => a + (r.instagram_dead ?? 0), 0);
      const sc = runs.reduce((a, r) => a + (r.scrape_dead ?? 0), 0);
      const wb = runs.reduce((a, r) => a + (r.web_dead ?? 0), 0);
      await fireAlert("dead_detected", {
        instagram_dead: ig,
        scrape_dead: sc,
        web_dead: wb,
        details: {
          consecutive: s.consecutive,
          min_dead_per_run: s.min_dead_per_run,
          runs_considered: runs.length,
        },
      });
    }

    return json(200, {
      ok: true,
      triggered: triggered.length,
      reasons: triggered,
      stale: isStale,
      breach: allBreach,
      last_run_at: lastRunAt,
    });
  } catch (e) {
    return json(500, { ok: false, error: (e as Error).message ?? "internal_error" });
  }
});
