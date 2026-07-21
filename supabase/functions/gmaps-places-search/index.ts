// Melhoria #3 — Google Places API (New) via connector gateway.
// Alternativa oficial ao scraping HTML. Só executa se o feature flag
// `use_places_api_new` estiver ativo e o conector Google Maps linkado
// (variáveis LOVABLE_API_KEY + GOOGLE_MAPS_API_KEY presentes).
//
// POST body: { query: string; max_results?: number; language?: string }
// Resposta: { source: "places_api_new" | "unavailable"; places: any[]; trace_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.types",
  "places.businessStatus",
].join(",");

const BodySchema = z.object({
  query: z.string().min(2).max(500),
  max_results: z.number().int().min(1).max(20).optional(),
  language: z.string().min(2).max(5).default("pt-BR"),
});

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const traceId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing_auth", trace_id: traceId });
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json(401, { error: "invalid_auth", trace_id: traceId });

    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return json(200, {
        source: "unavailable",
        reason: "google_maps_connector_not_linked",
        places: [],
        trace_id: traceId,
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(400, { error: "invalid_body", details: parsed.error.flatten(), trace_id: traceId });
    }

    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: parsed.data.query,
        languageCode: parsed.data.language,
        maxResultCount: parsed.data.max_results ?? 10,
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(JSON.stringify({ level: "error", trace_id: traceId, status: res.status, details }));
      return json(res.status, { error: "provider_error", status: res.status, details, trace_id: traceId });
    }

    const data = await res.json() as { places?: unknown[] };
    const places = data.places ?? [];

    // Registra consumo (tier "pro" pois FIELD_MASK inclui rating/phone/website).
    // Falha silenciosa: contabilidade não deve derrubar a resposta.
    try {
      if (SUPABASE_SERVICE_ROLE_KEY && places.length > 0) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: orgId } = await supabase.rpc("default_org_for_current_user");
        if (orgId) {
          await admin.rpc("record_places_api_call", {
            _organization_id: orgId,
            _tier: "pro",
            _calls: places.length,
          });
        }
      }
    } catch (accErr) {
      console.warn(JSON.stringify({ level: "warn", trace_id: traceId, msg: "usage_record_failed", err: (accErr as Error).message }));
    }

    return json(200, { source: "places_api_new", places, trace_id: traceId });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", trace_id: traceId, err: (err as Error).message }));
    return json(500, { error: "internal_error", details: (err as Error).message, trace_id: traceId });
  }
});
