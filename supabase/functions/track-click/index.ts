// Redirect 302 com tracking de click — público, sem JWT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyTrackingParams } from "../_shared/tracking-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function isSafeUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const recipientId = url.searchParams.get("r");
  const target = url.searchParams.get("u");
  const signature = url.searchParams.get("s");

  if (!target || !isSafeUrl(target)) {
    return new Response("Invalid URL", { status: 400, headers: corsHeaders });
  }

  if (!recipientId || !/^[0-9a-f-]{36}$/i.test(recipientId)) {
    return new Response("Invalid recipient", { status: 400, headers: corsHeaders });
  }

  // Sem vínculo criptográfico entre `r` e `u`, este endpoint público era um
  // open redirect: qualquer um podia montar um link que aparenta vir do
  // domínio confiável do projeto e redireciona para um site de phishing.
  // A assinatura garante que o link só é aceito se foi emitido por quem
  // conhece o segredo do servidor (ver _shared/tracking-signature.ts).
  const secret = Deno.env.get("TRACKING_SIGNING_SECRET");
  if (!secret) {
    console.error("track-click: TRACKING_SIGNING_SECRET não configurado");
    return new Response("Not configured", { status: 500, headers: corsHeaders });
  }
  if (!(await verifyTrackingParams(recipientId, target, signature, secret))) {
    return new Response("Invalid signature", { status: 403, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    await supabase.rpc("record_campaign_event", {
      _recipient_id: recipientId,
      _event_type: "click",
      _url: target,
      _ip: ip,
      _ua: ua,
    });
  } catch (e) {
    console.error("track-click error", e);
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target, "Cache-Control": "no-store" },
  });
});