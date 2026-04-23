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

    const { provider, redirect_uri, scope_type, organization_id, dry_run } = await req.json();
    if (provider !== "gmail" && provider !== "outlook") {
      return json({ error: "Invalid provider" }, 400);
    }
    if (!redirect_uri || typeof redirect_uri !== "string") {
      return json({ error: "redirect_uri required" }, 400);
    }
    // Validação básica de redirect_uri
    let redirectParsed: URL | null = null;
    try { redirectParsed = new URL(redirect_uri); } catch { return json({ error: "redirect_uri inválido (URL malformada)" }, 400); }
    if (!["https:", "http:"].includes(redirectParsed.protocol)) {
      return json({ error: "redirect_uri precisa usar http(s)" }, 400);
    }
    if (redirectParsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(redirectParsed.hostname)) {
      return json({ error: "http só permitido em localhost; use https em produção" }, 400);
    }
    const scopeType: "user" | "organization" = scope_type === "organization" ? "organization" : "user";

    // Resolve organization_id (default org if not provided)
    let orgId: string | null = organization_id ?? null;
    if (!orgId) {
      const { data: defaultOrg } = await supabase.rpc("default_org_for_current_user");
      orgId = (defaultOrg as string | null) ?? null;
    }
    if (!orgId) return json({ error: "No organization context" }, 400);

    // If shared mailbox: enforce admin role
    if (scopeType === "organization") {
      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_org_role", {
        _org_id: orgId,
        _user_id: userId,
        _min_role: "admin",
      });
      if (roleErr || !isAdmin) {
        return json({ error: "Apenas admins podem conectar caixas compartilhadas" }, 403);
      }
    }

    // State carries: userId.scopeType.orgId.nonce
    const state = `${userId}.${scopeType}.${orgId}.${crypto.randomUUID()}`;
    const scopes = provider === "gmail" ? GMAIL_SCOPES : OUTLOOK_SCOPES;

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

    if (dry_run) {
      // Modo sandbox: não inicia OAuth real — devolve diagnóstico completo
      return json({
        dry_run: true,
        provider,
        scope_type: scopeType,
        organization_id: orgId,
        redirect_uri,
        redirect_uri_normalized: redirectParsed.toString(),
        scopes,
        client_id_configured: provider === "gmail"
          ? !!Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")
          : !!Deno.env.get("MS_OAUTH_CLIENT_ID"),
        client_secret_configured: provider === "gmail"
          ? !!Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")
          : !!Deno.env.get("MS_OAUTH_CLIENT_SECRET"),
        auth_url_preview: authUrl,
        warnings: buildWarnings(redirectParsed, provider),
      });
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

function buildWarnings(u: URL, provider: "gmail" | "outlook"): string[] {
  const w: string[] = [];
  if (u.protocol === "http:") w.push("Usando http — apenas válido localmente.");
  if (u.hostname.includes("lovable.app") && provider === "gmail") {
    w.push("Domínio *.lovable.app precisa estar autorizado no Google Cloud Console como Authorized redirect URI.");
  }
  if (u.hostname.includes("lovable.app") && provider === "outlook") {
    w.push("Domínio *.lovable.app precisa estar autorizado no Azure App Registration como Redirect URI (tipo Web).");
  }
  if (u.search) w.push("redirect_uri contém query string — alguns provedores rejeitam.");
  if (u.hash) w.push("redirect_uri contém hash — provedores OAuth ignoram fragmentos.");
  return w;
}