// Lead Scoring ML — pontua um stakeholder com Gemini 2.5 Flash
// Enriquece o scoring heurístico (SQL) com análise contextual de IA:
//   - Perfil do stakeholder (cargo, seniority, contatos)
//   - Histórico de intent signals (últimos 30 dias)
//   - Deals ativos vinculados à empresa
//   - Atividades recentes
//
// POST { stakeholder_id: uuid }
// → { score: number, tier: "hot"|"warm"|"cold", reasoning: string, signals: Record<string,number> }
//
// Atualiza lead_scores com o resultado (upsert).

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

const SYSTEM_PROMPT = `Você é um modelo de lead scoring para vendas B2B empresariais no Brasil.
Analise o perfil completo do stakeholder e retorne um JSON com exatamente esta estrutura:

{
  "score": number entre 0 e 100,
  "tier": "hot" | "warm" | "cold",
  "reasoning": string (máx 300 chars, em português, explica o score),
  "signals": {
    "cargo_decisor"?: number,
    "intent_signals"?: number,
    "deals_ativos"?: number,
    "recencia_contato"?: number,
    "completude_perfil"?: number,
    "tecnologias_relevantes"?: number,
    "atividades_recentes"?: number
  }
}

Regras:
- hot = score >= 70 (decisor + sinais claros de interesse)
- warm = score 40-69 (gestor ou perfil parcial)
- cold = score < 40 (operacional, sem sinais, dados incompletos)
- Peso maior para: cargo C-level/diretor, sinais de intenção recentes, deals em negociação
- Retorne APENAS o JSON válido, sem markdown.`;

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

  // Verifica membership
  const { data: member } = await adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return json(403, { error: "Sem org ativa" });

  let body: { stakeholder_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "JSON invalido" }); }

  const { stakeholder_id } = body;
  if (!stakeholder_id) return json(400, { error: "stakeholder_id obrigatorio" });

  // Busca stakeholder + dados de contexto em paralelo
  const [shRes, intentsRes, dealsRes] = await Promise.all([
    adminClient.from("stakeholders").select("*").eq("id", stakeholder_id).eq("organization_id", member.organization_id).maybeSingle(),
    adminClient.from("intent_signals").select("type, signal, score, source, created_at").eq("stakeholder_id", stakeholder_id).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(10),
    adminClient.from("deals").select("title, stage_id, value, updated_at").eq("organization_id", member.organization_id).eq("company_id", "(select company_id from stakeholders where id = '" + stakeholder_id + "')").is("deleted_at", null).limit(5),
  ]);

  if (!shRes.data) return json(404, { error: "Stakeholder nao encontrado" });
  const sh = shRes.data as Record<string, unknown>;
  const intents = (intentsRes.data ?? []) as Array<Record<string, unknown>>;
  const deals = (dealsRes.data ?? []) as Array<Record<string, unknown>>;

  // Monta contexto para o LLM
  const context = {
    stakeholder: {
      nome: sh.name,
      cargo: sh.role,
      seniority: sh.seniority,
      empresa: sh.company_name,
      tem_email: !!sh.email,
      tem_telefone: !!sh.phone,
      tem_linkedin: !!sh.linkedin_url,
      ultimo_contato: sh.last_contacted_at,
      confidence_score: sh.confidence_score,
    },
    intent_signals_30d: intents.map((i) => ({
      tipo: i.type,
      sinal: i.signal,
      score: i.score,
      fonte: i.source,
      data: i.created_at,
    })),
    deals_ativos: deals.map((d) => ({
      titulo: d.title,
      valor: d.value,
      atualizado_em: d.updated_at,
    })),
  };

  // Chama LLM
  let result: { score: number; tier: string; reasoning: string; signals: Record<string, number> };
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
          { role: "user", content: JSON.stringify(context, null, 2) },
        ],
        max_tokens: 600,
        temperature: 0.1,
      }),
    });

    if (!llmResp.ok) {
      const err = await llmResp.text();
      return json(502, { error: `LLM error: ${err.substring(0, 200)}` });
    }

    const llmData = await llmResp.json();
    const rawContent = llmData.choices?.[0]?.message?.content ?? "{}";
    const cleaned = rawContent.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    return json(502, { error: `Falha no scoring: ${(err as Error).message}` });
  }

  // Upsert em lead_scores
  const { error: upsertErr } = await adminClient
    .from("lead_scores")
    .upsert({
      stakeholder_id,
      organization_id: member.organization_id,
      score: Math.round(Math.max(0, Math.min(100, result.score))),
      tier: result.tier,
      signals: { ...result.signals, ai_reasoning: result.reasoning, ai_scored: true },
      computed_at: new Date().toISOString(),
    }, { onConflict: "stakeholder_id" });

  if (upsertErr) return json(500, { error: upsertErr.message });

  return json(200, result);
});