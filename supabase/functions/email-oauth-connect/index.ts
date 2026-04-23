// Inicia OAuth flow Gmail/Outlook — retorna URL de autorização
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];
const OUTLOOK_SCOPES = [
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.Read",
  "openid",
  "email",
  "offline_access",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { provider, redirect_uri } = await req.json();
    if (provider !== "gmail" && provider !== "outlook") {
      return json({ error: "Invalid provider" }, 400);
    }
    if (!redirect_uri || typeof redirect_uri !== "string") {
      return json({ error: "redirect_uri required" }, 400);
    }

    const state = `${userId}.${crypto.randomUUID()}`;

    let authUrl: string;
    if (provider === "gmail") {
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      if (!clientId) return json({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" }, 500);
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", clientId);
      u.searchParams.set("redirect_uri", redirect_uri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("access_type", "offline");
      u.searchParams.set("prompt", "consent");
      u.searchParams.set("scope", GMAIL_SCOPES.join(" "));
      u.searchParams.set("state", state);
      authUrl = u.toString();
    } else {
      const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID");
      if (!clientId) return json({ error: "MS_OAUTH_CLIENT_ID not configured" }, 500);
      const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      u.searchParams.set("client_id", clientId);
      u.searchParams.set("redirect_uri", redirect_uri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("response_mode", "query");
      u.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
      u.searchParams.set("state", state);
      authUrl = u.toString();
    }

    return json({ url: authUrl, state });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}