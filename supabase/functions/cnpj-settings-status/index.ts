// Status das configurações do enriquecimento CNPJá.
// Retorna se a API key privada está configurada, qual endpoint está ativo,
// limite/minuto vigente e métricas resumidas de cache/fila.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CNPJA_API_KEY = Deno.env.get("CNPJA_API_KEY");
const LIMIT_AUTH_RPM = Number(Deno.env.get("CNPJA_LIMIT_RPM") ?? 60);
const LIMIT_OPEN_RPM = Number(Deno.env.get("CNPJA_OPEN_LIMIT_RPM") ?? 5);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const traceId = crypto.randomUUID();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing_auth", trace_id: traceId });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json(401, { error: "invalid_auth", trace_id: traceId });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const hasKey = !!CNPJA_API_KEY;
    const source = hasKey ? "cnpja" : "cnpja_open";
    const limitPerMinute = hasKey ? LIMIT_AUTH_RPM : LIMIT_OPEN_RPM;

    const [cacheStats, rateStat, queueStats] = await Promise.all([
      admin.from("cnpj_enrich_cache").select("status", { count: "exact", head: false }).limit(1000),
      admin.from("cnpj_enrich_rate_state").select("*").eq("source", source).maybeSingle(),
      admin.from("cnpj_enrich_queue").select("status", { count: "exact", head: false }).limit(1000),
    ]);

    const cacheTotal = cacheStats.data?.length ?? 0;
    const cacheSuccess = cacheStats.data?.filter((r) => r.status === "success").length ?? 0;
    const cacheNotFound = cacheStats.data?.filter((r) => r.status === "not_found").length ?? 0;

    const queueBreakdown = { pending: 0, processing: 0, completed: 0, failed: 0, not_found: 0 };
    for (const row of queueStats.data ?? []) {
      const s = row.status as keyof typeof queueBreakdown;
      if (s in queueBreakdown) queueBreakdown[s]++;
    }

    return json(200, {
      hasKey,
      source,
      limitPerMinute,
      cache: { total: cacheTotal, success: cacheSuccess, not_found: cacheNotFound },
      rate: rateStat.data
        ? {
            windowStart: rateStat.data.window_start,
            requestCount: rateStat.data.request_count,
            limit: rateStat.data.limit_per_minute,
          }
        : null,
      queue: queueBreakdown,
      trace_id: traceId,
    });
  } catch (err) {
    return json(500, { error: (err as Error).message, trace_id: traceId });
  }
});
