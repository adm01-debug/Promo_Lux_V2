// Diagnóstico das credenciais dos motores de Instagram (HikerAPI / Bright Data / Apify).
// Retorna presença de secrets e testa conectividade real quando possível.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ProviderStatus {
  provider: "hikerapi" | "brightdata" | "apify";
  label: string;
  configured: boolean;
  mock_mode?: boolean;
  reachable?: boolean;
  latency_ms?: number;
  http_status?: number;
  error?: string;
  hint: string;
}

async function checkHiker(): Promise<ProviderStatus> {
  const key = Deno.env.get("HIKER_API_KEY") ?? "";
  const mock = Deno.env.get("HIKER_MOCK_MODE") === "true";
  const base: ProviderStatus = {
    provider: "hikerapi",
    label: "HikerAPI",
    configured: !!key,
    mock_mode: mock,
    hint: "Defina HIKER_API_KEY nos Secrets. Opcional: HIKER_MOCK_MODE=true para simular respostas.",
  };
  if (!key && !mock) return base;
  if (mock && !key) return { ...base, reachable: true };
  try {
    const t0 = performance.now();
    const res = await fetch("https://api.hikerapi.com/v2/user/by/username?username=instagram", {
      headers: { "x-access-key": key, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const latency = Math.round(performance.now() - t0);
    return {
      ...base,
      reachable: res.status < 500 && res.status !== 401 && res.status !== 403,
      latency_ms: latency,
      http_status: res.status,
      error: res.status === 401 || res.status === 403 ? "Credencial rejeitada pela HikerAPI" : undefined,
    };
  } catch (e) {
    return { ...base, reachable: false, error: (e as Error).message };
  }
}

async function checkBrightData(): Promise<ProviderStatus> {
  const token = Deno.env.get("BRIGHTDATA_API_TOKEN") ?? "";
  const base: ProviderStatus = {
    provider: "brightdata",
    label: "Bright Data",
    configured: !!token,
    hint: "Defina BRIGHTDATA_API_TOKEN nos Secrets (Dataset API do painel Bright Data).",
  };
  if (!token) return base;
  try {
    const t0 = performance.now();
    const res = await fetch("https://api.brightdata.com/dca/datasets", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const latency = Math.round(performance.now() - t0);
    return {
      ...base,
      reachable: res.status < 500 && res.status !== 401 && res.status !== 403,
      latency_ms: latency,
      http_status: res.status,
      error: res.status === 401 || res.status === 403 ? "Token Bright Data inválido" : undefined,
    };
  } catch (e) {
    return { ...base, reachable: false, error: (e as Error).message };
  }
}

async function checkApify(): Promise<ProviderStatus> {
  const token = Deno.env.get("APIFY_API_KEY") ?? Deno.env.get("APIFY_TOKEN") ?? "";
  const base: ProviderStatus = {
    provider: "apify",
    label: "Apify",
    configured: !!token,
    hint: "Opcional. Conecte via Standard Connectors ou defina APIFY_API_KEY.",
  };
  if (!token) return base;
  try {
    const t0 = performance.now();
    const res = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const latency = Math.round(performance.now() - t0);
    return {
      ...base,
      reachable: res.ok,
      latency_ms: latency,
      http_status: res.status,
      error: !res.ok ? `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return { ...base, reachable: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const [hiker, brightdata, apify] = await Promise.all([
      checkHiker(),
      checkBrightData(),
      checkApify(),
    ]);
    const providers = [hiker, brightdata, apify];
    const primary = hiker.configured || hiker.mock_mode ? "hikerapi" : brightdata.configured ? "brightdata" : apify.configured ? "apify" : null;
    return new Response(
      JSON.stringify({
        checked_at: new Date().toISOString(),
        primary_provider: primary,
        providers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
