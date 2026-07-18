import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
];
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const MAX_IDENTIFIER_LEN = 254; // limite de email por RFC 5321

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentifier = typeof body?.identifier === "string" ? body.identifier : "";
    const identifier = rawIdentifier.trim().toLowerCase().slice(0, MAX_IDENTIFIER_LEN);

    if (!identifier) {
      return new Response(JSON.stringify({ error: "Identifier is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A chave é (identifier, IP do chamador) — não o identifier sozinho.
    // Chaveado só por identifier (ex.: o email digitado no login), qualquer
    // pessoa não-autenticada podia POSTar o email de uma vítima 5x e
    // bloquear o login dela por 15min, de qualquer lugar, sem saber a senha
    // (DoS de conta gratuito, sem autenticação). Compor com o IP do
    // chamador neutraliza isso: o atacante não sabe de qual IP a vítima vai
    // realmente tentar logar, então só consegue travar o bucket
    // (email_da_vítima, IP_do_atacante) — que não afeta o login real dela.
    // Mantém a proteção real: um brute-forcer iterando senhas para o mesmo
    // email a partir do mesmo IP ainda é bloqueado normalmente.
    const callerIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${identifier}|${callerIp}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar registro atual
    const { data: record, error: fetchError } = await supabaseAdmin
      .from("auth_rate_limits")
      .select("*")
      .eq("identifier", rateLimitKey)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const now = new Date();

    // Se estiver bloqueado, verificar se o bloqueio expirou
    if (record?.locked_until && new Date(record.locked_until) > now) {
      const remaining = Math.ceil((new Date(record.locked_until).getTime() - now.getTime()) / 1000);
      return new Response(JSON.stringify({ locked: true, remainingSec: remaining }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Incrementar tentativas
    // Se a última tentativa foi há mais de WINDOW_MINUTES, resetar contador
    const lastAttempt = record?.last_attempt ? new Date(record.last_attempt) : null;
    const isOld = lastAttempt && (now.getTime() - lastAttempt.getTime() > WINDOW_MINUTES * 60 * 1000);

    const attempts = isOld ? 1 : (record?.attempts ?? 0) + 1;
    let locked_until = null;

    if (attempts >= MAX_ATTEMPTS) {
      locked_until = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000).toISOString();
      // Não resetamos as attempts aqui para que o bloqueio seja mantido se ele tentar novamente durante o locked_until
    }

    if (record) {
      await supabaseAdmin
        .from("auth_rate_limits")
        .update({ attempts, last_attempt: now.toISOString(), locked_until })
        .eq("identifier", rateLimitKey);
    } else {
      await supabaseAdmin
        .from("auth_rate_limits")
        .insert({ identifier: rateLimitKey, attempts, last_attempt: now.toISOString(), locked_until });
    }

    return new Response(JSON.stringify({ locked: !!locked_until, attempts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
