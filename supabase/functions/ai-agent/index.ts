import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate input with Zod
    const parsed = MessageSchema.safeParse(await req.json());
    if (!parsed.success) {
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
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
