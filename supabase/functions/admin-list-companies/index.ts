import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://promo-lux-v2.vercel.app",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:5173",
];

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

// Endpoint admin: lista companies de TODAS as orgs.
//
// Autorizacao por JWT + papel `admin`. Antes usava um token compartilhado
// (`ADMIN_LIST_TOKEN`) lido pelo front via `VITE_ADMIN_LIST_TOKEN`; toda env
// `VITE_*` e inlinada no bundle JS publico em build time, entao o token era
// legivel por qualquer visitante e liberava este endpoint com service_role.
// Nao ha mais segredo compartilhado: a autorizacao e o JWT do usuario.
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Listar companies de TODAS as orgs exige ser `admin` em alguma organizacao.
  // Sem isso, qualquer usuario autenticado leria a base inteira.
  const { data: adminRows, error: adminErr } = await supabaseUser
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  if (adminErr || !adminRows?.length) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 1000);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const search = url.searchParams.get("q")?.trim();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Service-role bypassa RLS — lista de TODAS as orgs.
  // NOTA: companies.organization_id não tem FK formal para organizations,
  // então não dá pra embed via PostgREST — listamos companies direto e
  // deixamos o front agrupar/cross-ref se precisar do nome da org.
  let query = supabaseAdmin
    .from("companies")
    .select("id, name, sector, location, ipc_score, enriched, starred, organization_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sector.ilike.%${search}%,location.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ total: count, count: data?.length ?? 0, companies: data ?? [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
