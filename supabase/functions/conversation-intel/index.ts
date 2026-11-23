// Conversation Intelligence — analisa textos de interações de vendas
// (emails, notas, ligações) usando LLM e extrai:
//   • sentimento (positive/neutral/negative)
//   • sinais de compra (buying_signals[])
//   • itens de ação (action_items[])
//   • próximos passos sugeridos (next_steps[])
//   • tópicos-chave (topics[])
//   • resumo executivo (summary)
//
// POST { deal_id: uuid, text: string, text_type: "email"|"note"|"call"|"message" }
// → { analysis: ConversationAnalysis, activity_id: uuid }
//
// O resultado é salvo como deal_activity type="conversation_intel".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um analista especializado em vendas B2B.
Analise o texto de uma interação de vendas e retorne um JSON com exatamente esta estrutura:

{
  "sentiment": "positive" | "neutral" | "negative",
  "sentiment_score": number entre -1.0 e 1.0,
  "buying_signals": string[],
  "objections": string[],
  "action_items": string[],
  "next_steps": string[],
  "topics": string[],
  "urgency": "high" | "medium" | "low",
  "deal_stage_hint": "prospecting" | "qualification" | "proposal" | "negotiation" | "closing" | "won" | "lost" | null,
  "summary": string (máx 200 chars)
}

Seja específico e orientado a ação. Retorne APENAS o JSON, sem markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "Unauthorized" });

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return json(401, { error: "Unauthorized" });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: { deal_id?: string; text?: string; text_type?: string };
  try { body = await req.json(); } catch { return json(400, { error: "JSON invalido" }); }

  const { deal_id, text, text_type = "note" } = body;
  if (!deal_id) return json(400, { error: "deal_id obrigatorio" });
  if (!text || text.trim().length < 10) return json(400, { error: "text muito curto (min 10 chars)" });

  // Verifica membership
  const { data: member } = await adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return json(403, { error: "Sem org ativa" });

  // Verifica deal existe e pertence ao user
  const { data: deal } = await adminClient
    .from("deals")
    .select("id, title, company_name")
    .eq("id", deal_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return json(404, { error: "Deal nao encontrado" });

  // Chama LLM
  let analysis: Record<string, unknown>;
  try {
    const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Tipo: ${text_type}\nDeal: ${deal.title ?? ""} (${deal.company_name ?? ""})\n\n---\n${text.trim().substring(0, 4000)}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!llmResp.ok) {
      const err = await llmResp.text();
      return json(502, { error: `LLM error: ${err.substring(0, 200)}` });
    }

    const llmData = await llmResp.json();
    const rawContent = llmData.choices?.[0]?.message?.content ?? "{}";
    // Strip possible markdown code fences
    const cleaned = rawContent.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    analysis = JSON.parse(cleaned);
  } catch (err) {
    return json(502, { error: `Falha na analise: ${(err as Error).message}` });
  }

  // Salva como deal_activity
  const { data: activity, error: insertErr } = await adminClient
    .from("deal_activities")
    .insert({
      deal_id,
      user_id: user.id,
      organization_id: member.organization_id,
      type: "conversation_intel",
      description: (analysis.summary as string) ?? "Analise de conversa",
      metadata: {
        text_type,
        analysis,
        analyzed_at: new Date().toISOString(),
        char_count: text.length,
      },
    })
    .select("id")
    .single();

  if (insertErr) return json(500, { error: insertErr.message });

  return json(200, { analysis, activity_id: activity.id });
});