// Troca code -> tokens, busca email do usuário e persiste em email_accounts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: cErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { provider, code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return json({ error: "code and redirect_uri required" }, 400);
    if (provider !== "gmail" && provider !== "outlook") return json({ error: "Invalid provider" }, 400);

    // Troca code por tokens
    let tokens: { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
    let email = "";
    let displayName = "";

    if (provider === "gmail") {
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      const secret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
      if (!clientId || !secret) return json({ error: "Google OAuth not configured" }, 500);
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri, grant_type: "authorization_code" }),
      });
      tokens = await r.json();
      if (!r.ok) return json({ error: "Token exchange failed", details: tokens }, 400);

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      email = profile.email; displayName = profile.name ?? "";
    } else {
      const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID");
      const secret = Deno.env.get("MS_OAUTH_CLIENT_SECRET");
      if (!clientId || !secret) return json({ error: "Microsoft OAuth not configured" }, 500);
      const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri, grant_type: "authorization_code" }),
      });
      tokens = await r.json();
      if (!r.ok) return json({ error: "Token exchange failed", details: tokens }, 400);

      const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      email = profile.mail || profile.userPrincipalName;
      displayName = profile.displayName ?? "";
    }

    if (!email) return json({ error: "Could not retrieve email" }, 400);

    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    // Persiste com service role para garantir gravação dos tokens
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.from("email_accounts").upsert({
      user_id: userId,
      provider,
      email,
      display_name: displayName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      active: true,
      last_error: null,
    }, { onConflict: "user_id,provider,email" }).select().single();

    if (error) return json({ error: error.message }, 500);
    return json({ account: { id: data.id, email: data.email, provider: data.provider } });
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