// web-scrape-enqueue
// ------------------
// Endpoint público (JWT obrigatório) para enfileirar uma URL no motor de
// scraping web nativo. Valida URL, resolve organization_id do usuário e
// insere em `web_scrape_queue`. Devolve { task_id, trace_id }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  url: z.string().url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "URL deve ser http(s)",
  }),
  formats: z.array(z.enum(["markdown", "html", "links"])).min(1).max(3).default(["markdown"]),
  extract_schema: z.record(z.unknown()).optional(),
  wait_for_ms: z.number().int().min(0).max(15000).default(0),
  max_bytes: z.number().int().min(1024).max(10 * 1024 * 1024).default(2 * 1024 * 1024),
  priority: z.number().int().min(0).max(10).default(0),
  // SLA opcional (segundos). Se omitido é derivado abaixo por heurística.
  sla_seconds: z.number().int().min(10).max(3600).optional(),
});

/**
 * Deriva SLA para uma tarefa de scrape web a partir do payload.
 * Base 30s + wait_for + 10s por MB de teto — cobre timeout do worker
 * mais o custo esperado de extração/renderização.
 */
function deriveWebSla(wait_for_ms: number, max_bytes: number): number {
  const base = 30 + Math.ceil(wait_for_ms / 1000) + Math.ceil((max_bytes / 1_000_000) * 10);
  return Math.max(30, Math.min(1200, base));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "missing_authorization" });

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData.user) return json(401, { error: "invalid_token" });
  const user = userData.user;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const body = parsed.data;

  // Resolve organização default
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: org } = await admin.rpc("default_org_for_current_user").single();
  const { data: memberRow } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const organizationId = (org as string | null) ?? (memberRow as { organization_id: string } | null)?.organization_id;
  if (!organizationId) return json(403, { error: "no_organization" });

  const extractHash = body.extract_schema
    ? await sha256(JSON.stringify(body.extract_schema))
    : null;
  const configHash = await sha256(
    [body.url, body.formats.join(","), extractHash ?? "", body.wait_for_ms, body.max_bytes].join("|"),
  );
  const traceId = crypto.randomUUID();

  const { data: inserted, error: insErr } = await admin
    .from("web_scrape_queue")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      url: body.url,
      formats: body.formats,
      extract_schema: body.extract_schema ?? null,
      extract_schema_hash: extractHash,
      wait_for_ms: body.wait_for_ms,
      max_bytes: body.max_bytes,
      priority: body.priority,
      config_hash: configHash,
      trace_id: traceId,
    })
    .select("id, trace_id")
    .single();

  if (insErr) {
    // idempotência: se caiu no unique parcial, devolve a task existente
    if ((insErr.code ?? "").startsWith("23")) {
      const { data: existing } = await admin
        .from("web_scrape_queue")
        .select("id, trace_id, status")
        .eq("organization_id", organizationId)
        .eq("config_hash", configHash)
        .in("status", ["queued", "processing"])
        .maybeSingle();
      if (existing) return json(200, { ...existing, deduplicated: true });
    }
    return json(500, { error: "insert_failed", message: insErr.message });
  }

  return json(202, { task_id: inserted.id, trace_id: inserted.trace_id });
});
