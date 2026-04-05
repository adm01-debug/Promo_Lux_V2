import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://id-preview--5ca97528-7ced-45bf-b83a-48ae8b7f46fc.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// ── Rate Limiter (in-memory token bucket per user) ──
const rateLimitStore = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT = { maxTokens: 10, refillRate: 2, windowMs: 60_000 }; // 10 req/min, refill 2/min

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let bucket = rateLimitStore.get(userId);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT.maxTokens, lastRefill: now };
    rateLimitStore.set(userId, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / RATE_LIMIT.windowMs) * RATE_LIMIT.refillRate;
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_LIMIT.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens <= 0) {
    const retryAfterMs = RATE_LIMIT.windowMs - (now - bucket.lastRefill);
    return { allowed: false, retryAfterMs };
  }
  bucket.tokens--;
  return { allowed: true, retryAfterMs: 0 };
}

// ── Structured Logger ──
function createLogger(requestId: string) {
  const base = { function: "ai-agent", request_id: requestId };
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info", msg, ...data, ts: new Date().toISOString() })),
    warn: (msg: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...base, level: "warn", msg, ...data, ts: new Date().toISOString() })),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ ...base, level: "error", msg, ...data, ts: new Date().toISOString() })),
  };
}

const MessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
});

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const log = createLogger(requestId);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = performance.now();
  log.info("request_start", { method: req.method });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log.warn("auth_missing");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      log.warn("auth_invalid", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Rate limit check
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      log.warn("rate_limited", { user_id: userId, retry_after_ms: rl.retryAfterMs });
      return new Response(JSON.stringify({ error: "Too many requests. Please wait before trying again." }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate input with Zod
    const parsed = MessageSchema.safeParse(await req.json());
    if (!parsed.success) {
      log.warn("validation_failed", { errors: parsed.error.flatten().fieldErrors });
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { message } = parsed.data;

    // Gather context from database
    const [
      { count: totalCompanies },
      { count: enrichedCompanies },
      { data: topCompanies },
      { data: recentCompanies },
      { count: totalWorkflows },
      { count: totalJobs },
      { data: ipcConfig },
      { data: sectorStats },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true).eq("user_id", userId),
      supabase.from("companies").select("name, sector, location, ipc_score, email, phone, website, enriched").eq("user_id", userId).order("ipc_score", { ascending: false }).limit(10),
      supabase.from("companies").select("name, sector, location, ipc_score, source, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("workflows").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("scrape_jobs").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("ipc_config").select("criteria").eq("is_active", true).eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("companies").select("sector").eq("user_id", userId),
    ]);

    // Build sector distribution
    const sectorMap = new Map<string, number>();
    (sectorStats ?? []).forEach((c: { sector: string | null }) => {
      const s = c.sector ?? "Outros";
      sectorMap.set(s, (sectorMap.get(s) || 0) + 1);
    });
    const sectorSummary = Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");

    const systemPrompt = `Você é o Agente IA do LUX IA, um sistema de automação de prospecção B2B.
Responda SEMPRE em Português do Brasil. Seja conciso, use emojis moderadamente e formate com markdown.

DADOS ATUAIS DO SISTEMA:
- Total de empresas: ${totalCompanies ?? 0}
- Empresas enriquecidas: ${enrichedCompanies ?? 0}
- Workflows criados: ${totalWorkflows ?? 0}
- Jobs de raspagem: ${totalJobs ?? 0}
- Setores: ${sectorSummary || "nenhum dado"}
- Critérios IPC ativos: ${ipcConfig?.criteria ? JSON.stringify(ipcConfig.criteria) : "padrão"}

TOP 10 EMPRESAS POR SCORE IPC:
${(topCompanies ?? []).map((c: Record<string, unknown>, i: number) => `${i + 1}. ${c.name} — Score ${c.ipc_score} — ${c.sector ?? "?"} — ${c.location ?? "?"} — ${c.enriched ? "✅ Enriquecida" : "⬜ Não enriquecida"}`).join("\n")}

ÚLTIMAS EMPRESAS ADICIONADAS:
${(recentCompanies ?? []).map((c: Record<string, unknown>) => `- ${c.name} (${c.source}) — Score ${c.ipc_score}`).join("\n")}

Você pode:
1. Responder perguntas sobre as empresas do banco
2. Sugerir ações (criar workflow, iniciar raspagem, enriquecer dados)
3. Analisar tendências e padrões nos dados
4. Recomendar empresas com base no IPC

Se o usuário pedir algo que requer ação (criar workflow, raspar, etc.), descreva os passos e sugira usar a interface correspondente.`;

    // Call Lovable AI (Google Gemini)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      log.error("ai_api_error", { status: aiResponse.status, body: errBody.slice(0, 500) });
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const reply = aiResult.choices?.[0]?.message?.content ?? "Desculpe, não consegui processar sua mensagem.";

    const duration = Math.round(performance.now() - start);
    log.info("request_complete", { duration_ms: duration, user_id: userId });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error("request_failed", { error: (err as Error).message, stack: (err as Error).stack, duration_ms: duration });
    return new Response(JSON.stringify({ error: "Internal server error. Please try again later.", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
