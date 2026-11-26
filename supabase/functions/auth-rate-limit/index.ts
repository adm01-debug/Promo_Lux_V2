import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://promo-lux-v2.vercel.app",
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

    // Incremento em uma unica transacao no banco (etapa 037). Ler o contador
    // aqui e gravar depois deixava N logins simultaneos lerem o mesmo valor:
    // 20 tentativas em paralelo terminavam com attempts=1 e sem bloqueio.
    const { data, error } = await supabaseAdmin.rpc("check_auth_rate_limit", {
      p_identifier: rateLimitKey,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_minutes: WINDOW_MINUTES,
    });

    if (error) {
      throw error;
    }

    const result = (data ?? {}) as {
      attempts?: number;
      locked?: boolean;
      alreadyLocked?: boolean;
      remainingSec?: number;
    };

    // Bloqueio que ja valia antes desta chamada mantem o 429 historico. Quem
    // atinge o teto agora segue recebendo 200 com locked=true, que e o unico
    // formato que o cliente aplica: functions.invoke trata nao-2xx como erro e
    // o hook faz fail-open.
    if (result.alreadyLocked) {
      const remainingSec = result.remainingSec || WINDOW_MINUTES * 60;
      return new Response(JSON.stringify({ locked: true, remainingSec }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ locked: !!result.locked, attempts: result.attempts ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
