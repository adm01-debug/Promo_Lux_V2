import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS restrito ──
const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * P1-7 — Reporta a saúde do cookie Lusha para exibir banner no front-end.
 * Requer JWT válido (qualquer usuário autenticado).
 *
 * Resposta:
 *   { status: 'healthy' | 'expiring_soon' | 'expired' | 'error' | 'unknown',
 *     days_since_update: number | null,
 *     expires_in_days: number | null,
 *     message: string }
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Consulta cookies_config no self-hosted ──
  const externalUrl = Deno.env.get("SUPABASE_EXTERNAL_URL") ?? "https://supabase.atomicabr.com.br";
  const externalKey = Deno.env.get("SUPABASE_EXTERNAL_ANON_KEY") ?? "";

  if (!externalKey) {
    return new Response(
      JSON.stringify({
        status: "unknown",
        message: "Vault self-hosted não configurado (SUPABASE_EXTERNAL_ANON_KEY ausente).",
        days_since_update: null,
        expires_in_days: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch(
      `${externalUrl}/rest/v1/cookies_config?servico=eq.lusha&select=health_status,atualizado_em,expires_at,health_error&limit=1`,
      {
        headers: { apikey: externalKey, Authorization: `Bearer ${externalKey}` },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Falha ao consultar vault (HTTP ${res.status}).`,
          days_since_update: null,
          expires_in_days: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows: Array<{
      health_status: string | null;
      atualizado_em: string | null;
      expires_at: string | null;
      health_error: string | null;
    }> = await res.json();

    if (!rows.length) {
      return new Response(
        JSON.stringify({
          status: "expired",
          message: "Cookie Lusha não encontrado no vault. Renovação necessária.",
          days_since_update: null,
          expires_in_days: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const row = rows[0];
    const now = Date.now();
    const daysSinceUpdate = row.atualizado_em
      ? Math.floor((now - new Date(row.atualizado_em).getTime()) / 86_400_000)
      : null;
    const expiresInDays = row.expires_at
      ? Math.floor((new Date(row.expires_at).getTime() - now) / 86_400_000)
      : null;

    // Deriva status final (self-hosted health_status + expiração)
    let status: "healthy" | "expiring_soon" | "expired" | "error" = "healthy";
    if (row.health_status === "expired" || (expiresInDays !== null && expiresInDays < 0)) {
      status = "expired";
    } else if (row.health_status === "error") {
      status = "error";
    } else if (row.health_status === "expiring_soon" || (expiresInDays !== null && expiresInDays <= 7)) {
      status = "expiring_soon";
    }

    const messages: Record<typeof status, string> = {
      healthy: "Cookie Lusha saudável.",
      expiring_soon: `Cookie Lusha expira em ${expiresInDays ?? "?"} dia(s). Renove em breve.`,
      expired: "Cookie Lusha expirado. Renovação necessária para novas buscas.",
      error: row.health_error ?? "Cookie Lusha com erro. Verifique o vault.",
    };

    return new Response(
      JSON.stringify({
        status,
        message: messages[status],
        days_since_update: daysSinceUpdate,
        expires_in_days: expiresInDays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: `Falha ao consultar vault: ${(err as Error).message}`,
        days_since_update: null,
        expires_in_days: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
