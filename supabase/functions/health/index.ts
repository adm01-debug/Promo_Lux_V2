import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
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

  // Check External APIs (Gmaps)
  const gmapsStart = performance.now();
  try {
    const res = await fetch("https://gmaps.atomicabr.com.br/api/v1/jobs", { signal: AbortSignal.timeout(3000) });
    results.checks.gmaps_api = { 
      status: res.ok ? "healthy" : "unhealthy", 
      latency_ms: Math.round(performance.now() - gmapsStart),
      status_code: res.status 
    };
  } catch (err) {
    results.checks.gmaps_api = { status: "unhealthy", error: (err as Error).message };
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
