// Pixel 1x1 tracking de aberturas — público, sem JWT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyTrackingParams } from "../_shared/tracking-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// GIF 1x1 transparente
const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const pixelHeaders = {
  ...corsHeaders,
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Sempre devolve o pixel; falha silenciosa para nunca quebrar a renderização do email
  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get("r");
    const signature = url.searchParams.get("s");
    if (!recipientId || !/^[0-9a-f-]{36}$/i.test(recipientId)) {
      return new Response(PIXEL, { headers: pixelHeaders });
    }

    // Sem assinatura, qualquer UUID em formato válido registrava um evento
    // de "open" falso para qualquer destinatário. Igual ao track-click, a
    // assinatura vincula `r` a quem gerou o link (ver
    // _shared/tracking-signature.ts) — mas o pixel é sempre devolvido, com
    // ou sem assinatura válida, para nunca quebrar a renderização do email.
    const secret = Deno.env.get("TRACKING_SIGNING_SECRET");
    if (!secret || !(await verifyTrackingParams(recipientId, null, signature, secret))) {
      return new Response(PIXEL, { headers: pixelHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    // Filtra prefetch de proxies de imagem comuns? Mantemos simples: registramos tudo.
    await supabase.rpc("record_campaign_event", {
      _recipient_id: recipientId,
      _event_type: "open",
      _url: null,
      _ip: ip,
      _ua: ua,
    });
  } catch (e) {
    console.error("track-open error", e);
  }

  return new Response(PIXEL, { headers: pixelHeaders });
});