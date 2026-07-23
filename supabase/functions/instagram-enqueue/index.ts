// deno-lint-ignore-file no-explicit-any
/**
 * instagram-enqueue — enfileira uma tarefa de coleta no Instagram.
 *
 * Contrato:
 *  POST { target_type: 'profile'|'posts'|'hashtag'|'comments',
 *         target_value: string,
 *         params?: { limit?: number, correlation_id?: string, max_attempts?: number } }
 *
 *  200 { queue_id, trace_id, deduplicated: boolean }
 *
 * Deduplicação: (organization_id, config_hash) — se já houver tarefa 'queued'/'running'
 * com o mesmo hash, devolve a existente (deduplicated=true).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TARGET_TYPES = new Set(["profile", "posts", "hashtag", "comments"]);

async function computeHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await authed.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claims?.claims?.sub) return json(401, { error: "unauthorized" });
  const userId = claims.claims.sub as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const target_type = String(body?.target_type ?? "");
  const target_value = String(body?.target_value ?? "").trim();
  const params = (body?.params ?? {}) as Record<string, any>;

  if (!TARGET_TYPES.has(target_type)) return json(400, { error: "invalid_target_type" });
  if (!target_value) return json(400, { error: "missing_target_value" });

  const limit = Math.max(1, Math.min(1000, Number(params.limit ?? 200)));
  const maxAttempts = Math.max(1, Math.min(10, Number(params.max_attempts ?? 4)));
  const correlation_id = params.correlation_id ?? null;

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // organização do usuário
  const { data: membership, error: memErr } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (memErr || !membership) return json(403, { error: "no_organization" });

  const organization_id = membership.organization_id as string;
  const normalizedTarget = target_value.toLowerCase().replace(/^@/, "").replace(/^#/, "");
  const config_hash = await computeHash(
    JSON.stringify({ organization_id, target_type, target: normalizedTarget, limit }),
  );

  // dedup
  const { data: existing } = await service
    .from("instagram_scrape_queue")
    .select("id, trace_id")
    .eq("organization_id", organization_id)
    .eq("config_hash", config_hash)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (existing) {
    return json(200, { queue_id: existing.id, trace_id: existing.trace_id, deduplicated: true });
  }

  const { data: inserted, error: insErr } = await service
    .from("instagram_scrape_queue")
    .insert({
      organization_id,
      target_type,
      target_value: normalizedTarget,
      params: { limit, ...params },
      config_hash,
      max_attempts: maxAttempts,
      correlation_id,
      created_by: userId,
    })
    .select("id, trace_id")
    .single();

  if (insErr) {
    console.error("[instagram-enqueue] insert failed", insErr);
    return json(500, { error: "insert_failed", details: insErr.message });
  }

  return json(200, { queue_id: inserted.id, trace_id: inserted.trace_id, deduplicated: false });
});
