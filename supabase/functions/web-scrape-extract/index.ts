// web-scrape-extract
// Recebe task_id + schema JSON, envia markdown → Lovable AI Gateway
// (Gemini 2.5 Flash) com structured output. Grava extracted_json em
// web_scrape_results. Só executa se `web_scrape_extract_enabled=true`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const BodySchema = z.object({
  task_id: z.string().uuid(),
  schema: z.record(z.unknown()),
  instruction: z.string().min(1).max(1000).default("Extraia os campos do schema a partir do markdown."),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "missing_authorization" });

  if (!LOVABLE_API_KEY) return json(503, { error: "ai_gateway_unavailable" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: flag } = await admin
    .from("feature_flags")
    .select("is_enabled")
    .eq("flag_key", "web_scrape_extract_enabled")
    .maybeSingle();
  if (!flag?.is_enabled) return json(403, { error: "extract_disabled" });

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData.user) return json(401, { error: "invalid_token" });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { task_id, schema, instruction } = parsed.data;

  const { data: task } = await supabase
    .from("web_scrape_queue")
    .select("id, result_id, organization_id")
    .eq("id", task_id)
    .maybeSingle();
  if (!task?.result_id) return json(404, { error: "task_or_result_not_found" });

  const { data: result } = await supabase
    .from("web_scrape_results")
    .select("id, markdown, url")
    .eq("id", task.result_id)
    .maybeSingle();
  if (!result?.markdown) return json(400, { error: "no_markdown_to_extract" });

  const started = Date.now();
  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um extrator estrito de dados. Responda apenas com JSON válido conforme o schema." },
        { role: "user", content: `${instruction}\n\nSCHEMA:\n${JSON.stringify(schema)}\n\nMARKDOWN:\n${result.markdown.slice(0, 30000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!aiRes.ok) {
    const errTxt = await aiRes.text();
    return json(502, { error: "ai_gateway_failed", status: aiRes.status, detail: errTxt.slice(0, 500) });
  }

  const aiJson = await aiRes.json();
  const content = aiJson.choices?.[0]?.message?.content;
  let extracted: unknown = null;
  try {
    extracted = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return json(502, { error: "ai_returned_invalid_json" });
  }

  await admin
    .from("web_scrape_results")
    .update({ extracted_json: extracted })
    .eq("id", result.id);

  return json(200, {
    task_id,
    result_id: result.id,
    extracted,
    duration_ms: Date.now() - started,
    usage: aiJson.usage ?? null,
  });
});
