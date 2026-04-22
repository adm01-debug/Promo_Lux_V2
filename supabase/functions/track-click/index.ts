// Redirect 302 com tracking de click — público, sem JWT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

  if (!target || !isSafeUrl(target)) {
    return new Response("Invalid URL", { status: 400, headers: corsHeaders });
  }

  if (recipientId && /^[0-9a-f-]{36}$/i.test(recipientId)) {
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
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target, "Cache-Control": "no-store" },
  });
});