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
import {
  clampLimit,
  computeConfigHash,
  normalizeTarget,
  type InstagramTargetType,
} from "../_shared/instagram-config-hash.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TARGET_TYPES = new Set(["profile", "posts", "hashtag", "comments"]);

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

  const limit = clampLimit(params.limit, 200);
  const maxAttempts = Math.max(1, Math.min(10, Number(params.max_attempts ?? 4)));
  const correlation_id = params.correlation_id ?? null;

  // SLA sensível ao tipo de alvo e ao volume solicitado.
  //   profile    → 60 + 2.0s/item   (custo por post fetchado)
  //   posts      → 60 + 1.5s/item
  //   hashtag    → 60 + 1.2s/item
  //   comments   → 60 + 0.8s/item
  //   override:  params.sla_seconds (10..3600)
  const perItem: Record<InstagramTargetType, number> = {
    profile: 2.0, posts: 1.5, hashtag: 1.2, comments: 0.8,
  };
  const derivedSla = Math.max(
    30,
    Math.min(3600, Math.round(60 + perItem[target_type as InstagramTargetType] * limit)),
  );
  const slaSeconds =
    Number.isFinite(Number(params.sla_seconds))
      ? Math.max(10, Math.min(3600, Number(params.sla_seconds)))
      : derivedSla;

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
  const normalizedTarget = normalizeTarget(target_value);
  const config_hash = await computeConfigHash({
    organization_id,
    target_type: target_type as InstagramTargetType,
    target_value: normalizedTarget,
    limit,
  });

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
      sla_seconds: slaSeconds,
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
