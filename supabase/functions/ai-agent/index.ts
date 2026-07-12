import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.includes("localhost") || origin.includes("127.0.0.1");
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
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

    // Gather context from database.
    // NOTA: a distribuição por setor é obtida via RPC agregada (get_sector_summary),
    // evitando um full-scan de todas as empresas a cada requisição de chat.
    const [
      { count: totalCompanies },
      { count: enrichedCompanies },
      { data: topCompanies },
      { data: recentCompanies },
      { count: totalWorkflows },
      { count: totalJobs },
      { data: ipcConfig },
      { data: sectorCounts },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true).eq("user_id", userId),
      supabase.from("companies").select("name, sector, location, ipc_score, email, phone, website, enriched").eq("user_id", userId).order("ipc_score", { ascending: false }).limit(10),
      supabase.from("companies").select("name, sector, location, ipc_score, source, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("workflows").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("scrape_jobs").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("ipc_config").select("criteria").eq("is_active", true).eq("user_id", userId).limit(1).maybeSingle(),
      supabase.rpc("get_sector_summary", { p_user_id: userId }),
    ]);


    
    const sectorSummary = (sectorCounts ?? [])
      .slice(0, 8)
      .map((s: { sector: string; count: number }) => `${s.sector || "Outros"}: ${s.count}`)
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
      throw new Error(`AI API error: ${aiResponse.status}`);
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
    log.error("request_failed", { error: (err as Error).message, duration_ms: duration });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
