import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { identifier } = await req.json();

    if (!identifier) {
      return new Response(JSON.stringify({ error: "Identifier is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Configuração de Rate Limit: 5 tentativas por 15 minutos
    const MAX_ATTEMPTS = 5;
    const WINDOW_MINUTES = 15;

    // Buscar registro atual
    const { data: record, error: fetchError } = await supabaseAdmin
      .from("auth_rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
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
        .eq("identifier", identifier);
    } else {
      await supabaseAdmin
        .from("auth_rate_limits")
        .insert({ identifier, attempts, last_attempt: now.toISOString(), locked_until });
    }

    return new Response(JSON.stringify({ locked: !!locked_until, attempts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
