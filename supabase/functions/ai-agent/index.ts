import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://id-preview--5ca97528-7ced-45bf-b83a-48ae8b7f46fc.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true),
      supabase.from("companies").select("name, sector, location, ipc_score, email, phone, website, enriched").order("ipc_score", { ascending: false }).limit(10),
      supabase.from("companies").select("name, sector, location, ipc_score, source, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("workflows").select("*", { count: "exact", head: true }),
      supabase.from("scrape_jobs").select("*", { count: "exact", head: true }),
      supabase.from("ipc_config").select("criteria").eq("is_active", true).limit(1).maybeSingle(),
      supabase.from("companies").select("sector"),
    ]);

    // Build sector distribution
    const sectorMap = new Map<string, number>();
    (sectorStats ?? []).forEach((c: any) => {
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
${(topCompanies ?? []).map((c: any, i: number) => `${i + 1}. ${c.name} — Score ${c.ipc_score} — ${c.sector ?? "?"} — ${c.location ?? "?"} — ${c.enriched ? "✅ Enriquecida" : "⬜ Não enriquecida"}`).join("\n")}

ÚLTIMAS EMPRESAS ADICIONADAS:
${(recentCompanies ?? []).map((c: any) => `- ${c.name} (${c.source}) — Score ${c.ipc_score}`).join("\n")}

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
      console.error("AI API error:", aiResponse.status, errBody);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const reply = aiResult.choices?.[0]?.message?.content ?? "Desculpe, não consegui processar sua mensagem.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Agent error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
