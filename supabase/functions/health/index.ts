import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isCronAuthorized } from "../_shared/cron-auth.ts";

const ALLOWED_ORIGINS = [
  "https://promo-lux-v2.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Etapa 035: sonda publica barata. Sem credencial de servico o endpoint nao
  // consulta o banco, nao gasta a Places API (paga) e nao grava em
  // health_checks — antes cada chamada anonima fazia as tres coisas e ainda
  // revelava quais segredos estavam ausentes. Diagnostico completo continua
  // disponivel para quem chama com a credencial de cron/servico.
  if (!isCronAuthorized(req)) {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const start = performance.now();
  type HealthCheckResult = {
    status: string;
    latency_ms?: number;
    status_code?: number;
    error?: string;
  };
  const results: {
    status: string;
    timestamp: string;
    checks: Record<string, HealthCheckResult>;
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {}
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check Database
  try {
    const { error } = await supabase.from("organizations").select("id").limit(1);
    if (error) throw error;
    results.checks.database = { status: "healthy", latency_ms: Math.round(performance.now() - start) };
  } catch (err) {
    results.status = "degraded";
    results.checks.database = { status: "unhealthy", error: (err as Error).message };
  }

  // Check External APIs (Gmaps): scraper externo + fallback Places API.
  // A extracao funciona se QUALQUER um dos dois responder, entao reportamos o
  // estado de cada um — antes o 404 do scraper marcava a extracao como
  // quebrada mesmo com a Places API saudavel.
  const gmapsStart = performance.now();
  try {
    const res = await fetch("https://gmaps.atomicabr.com.br/api/v1/jobs", { signal: AbortSignal.timeout(3000) });
    results.checks.gmaps_api = {
      status: res.ok ? "healthy" : "degraded",
      latency_ms: Math.round(performance.now() - gmapsStart),
      status_code: res.status,
      note: res.ok ? undefined : "scraper externo offline; fallback activo via Places API",
    };
  } catch (err) {
    results.checks.gmaps_api = { status: "degraded", error: (err as Error).message, note: "scraper externo offline; fallback activo via Places API" };
  }

  const placesKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  const placesStart = performance.now();
  if (!placesKey) {
    results.checks.google_places_api = { status: "unhealthy", error: "GOOGLE_MAPS_API_KEY ausente" };
  } else {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesKey,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({ textQuery: "cafe", maxResultCount: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      results.checks.google_places_api = {
        status: res.ok ? "healthy" : "unhealthy",
        latency_ms: Math.round(performance.now() - placesStart),
        status_code: res.status,
      };
    } catch (err) {
      results.checks.google_places_api = { status: "unhealthy", error: (err as Error).message };
    }
  }

  // Check AI Gateway (simple reachability)
  const aiStart = performance.now();
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/health", { signal: AbortSignal.timeout(3000) });
    results.checks.ai_gateway = { 
      status: res.ok ? "healthy" : "unhealthy", 
      latency_ms: Math.round(performance.now() - aiStart) 
    };
  } catch (err) {
    results.checks.ai_gateway = { status: "unhealthy", error: (err as Error).message };
  }

  // Log to health_checks table
  try {
    await supabase.from("health_checks").insert({
      service_name: "lux-ia-system",
      status: results.status,
      latency_ms: Math.round(performance.now() - start),
      metadata: results.checks
    });
  } catch (err) {
    console.error("Failed to log health check:", err);
  }

  return new Response(JSON.stringify(results), {
    status: results.status === "healthy" ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
