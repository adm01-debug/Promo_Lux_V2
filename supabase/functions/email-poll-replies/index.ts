// Polling de respostas Gmail/Outlook — chamado por cron a cada 5 min
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

interface EmailAccount {
  id: string; user_id: string; provider: "gmail" | "outlook"; email: string;
  access_token: string | null; refresh_token: string | null; expires_at: string | null;
  history_id: string | null; delta_link: string | null; last_polled_at: string | null;
  scope_type: "user" | "organization"; organization_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Permite filtrar por account_id e/ou scope_type no body (manual trigger) ou processa todas.
  // O cron sem body processa user + organization, mas cada conta é polled isoladamente
  // por id — nunca há cross-update entre escopos.
  let accountFilter: string | null = null;
  let scopeFilter: "user" | "organization" | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      accountFilter = body?.account_id ?? null;
      const s = body?.scope_type;
      if (s === "user" || s === "organization") scopeFilter = s;
    }
  } catch { /* ignore */ }

  let query = admin.from("email_accounts").select("*").eq("active", true);
  if (accountFilter) query = query.eq("id", accountFilter);
  if (scopeFilter) query = query.eq("scope_type", scopeFilter);
  const { data: accounts, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const results: Record<string, unknown>[] = [];
  for (const acc of (accounts ?? []) as EmailAccount[]) {
    // Defesa em profundidade: ignora linhas com scope_type inválido ou
    // organization scope sem organization_id — não devem existir, mas se
    // existirem evitamos qualquer escrita ambígua.
    if (acc.scope_type !== "user" && acc.scope_type !== "organization") {
      results.push({ account: acc.email, skipped: "invalid scope_type", scope_type: acc.scope_type });
      continue;
    }
    if (acc.scope_type === "organization" && !acc.organization_id) {
      results.push({ account: acc.email, skipped: "org scope without organization_id" });
      continue;
    }

    try {
      const fresh = await ensureFreshToken(admin, acc);
      const res = fresh.provider === "gmail"
        ? await pollGmail(admin, fresh)
        : await pollOutlook(admin, fresh);
      // Update escopo-safe: id + scope_type garantem que esta linha continua
      // sendo a mesma classe de conta (impede sobrescrita se scope_type mudou
      // no meio do poll).
      await admin.from("email_accounts")
        .update({ last_polled_at: new Date().toISOString(), last_error: null })
        .eq("id", acc.id)
        .eq("scope_type", acc.scope_type);
      results.push({ account: acc.email, scope_type: acc.scope_type, ...res });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Account ${acc.email} failed:`, msg);
      await admin.from("email_accounts")
        .update({ last_polled_at: new Date().toISOString(), last_error: msg })
        .eq("id", acc.id)
        .eq("scope_type", acc.scope_type);
      results.push({ account: acc.email, scope_type: acc.scope_type, error: msg });
    }
  }

  return json({ processed: results.length, results });
});

async function ensureFreshToken(admin: SupabaseClient, acc: EmailAccount): Promise<EmailAccount> {
  const expires = acc.expires_at ? new Date(acc.expires_at).getTime() : 0;
  if (expires > Date.now() + 30_000 && acc.access_token) return acc;
  if (!acc.refresh_token) throw new Error("No refresh token; reconnect required");

  let tokenUrl = "", clientId = "", secret = "";
  if (acc.provider === "gmail") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
    secret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
  } else {
    tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    clientId = Deno.env.get("MS_OAUTH_CLIENT_ID") ?? "";
    secret = Deno.env.get("MS_OAUTH_CLIENT_SECRET") ?? "";
  }
  if (!clientId || !secret) throw new Error(`OAuth credentials not configured for ${acc.provider}`);

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, refresh_token: acc.refresh_token, grant_type: "refresh_token" }),
  });
  const tokens = await r.json();
  if (!r.ok) throw new Error(`Refresh failed: ${JSON.stringify(tokens)}`);

  const newExpires = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  await admin.from("email_accounts").update({
    access_token: tokens.access_token,
    expires_at: newExpires,
    refresh_token: tokens.refresh_token ?? acc.refresh_token,
  })
    .eq("id", acc.id)
    .eq("scope_type", acc.scope_type);

  return { ...acc, access_token: tokens.access_token, expires_at: newExpires };
}

async function pollGmail(admin: SupabaseClient, acc: EmailAccount) {
  // Busca mensagens recebidas após last_polled_at (fallback: últimas 24h)
  const since = acc.last_polled_at ? Math.floor(new Date(acc.last_polled_at).getTime() / 1000) : Math.floor((Date.now() - 86400_000) / 1000);
  const q = encodeURIComponent(`in:inbox after:${since}`);
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`, {
    headers: { Authorization: `Bearer ${acc.access_token}` },
  });
  const list = await listRes.json();
  if (!listRes.ok) throw new Error(`Gmail list: ${JSON.stringify(list)}`);

  let inserted = 0, scanned = 0;
  for (const m of list.messages ?? []) {
    scanned++;
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Date`, {
      headers: { Authorization: `Bearer ${acc.access_token}` },
    });
    const msg = await msgRes.json();
    if (!msgRes.ok) continue;

    const headers = (msg.payload?.headers ?? []) as Array<{ name: string; value: string }>;
    const get = (n: string) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value ?? null;
    const inReplyTo = normalizeMsgId(get("In-Reply-To") || (get("References") ?? "").split(/\s+/).pop() || null);
    if (!inReplyTo) continue; // Não é reply

    const fromHeader = get("From") ?? "";
    const { email: fromEmail, name: fromName } = parseFromHeader(fromHeader);

    const { data } = await admin.rpc("record_campaign_reply", {
      _provider: "gmail",
      _provider_message_id: msg.id,
      _thread_id: msg.threadId,
      _in_reply_to: inReplyTo,
      _from_email: fromEmail,
      _from_name: fromName,
      _subject: get("Subject"),
      _snippet: msg.snippet ?? null,
      _body: null,
      _received_at: new Date(parseInt(msg.internalDate ?? "0")).toISOString(),
      _email_account_id: acc.id,
    });
    if (data) inserted++;
  }
  return { scanned, inserted };
}

async function pollOutlook(admin: SupabaseClient, acc: EmailAccount) {
  const since = acc.last_polled_at ?? new Date(Date.now() - 86400_000).toISOString();
  const filter = encodeURIComponent(`receivedDateTime ge ${since}`);
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${filter}&$top=50&$select=id,conversationId,subject,from,receivedDateTime,bodyPreview,internetMessageHeaders,internetMessageId&$orderby=receivedDateTime desc`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${acc.access_token}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(`Outlook list: ${JSON.stringify(data)}`);

  let inserted = 0, scanned = 0;
  for (const msg of data.value ?? []) {
    scanned++;
    const headers = (msg.internetMessageHeaders ?? []) as Array<{ name: string; value: string }>;
    const inReplyToRaw = headers.find(h => h.name.toLowerCase() === "in-reply-to")?.value
      ?? (headers.find(h => h.name.toLowerCase() === "references")?.value ?? "").split(/\s+/).pop() ?? null;
    const inReplyTo = normalizeMsgId(inReplyToRaw);
    if (!inReplyTo) continue;

    const { data: reply } = await admin.rpc("record_campaign_reply", {
      _provider: "outlook",
      _provider_message_id: msg.id,
      _thread_id: msg.conversationId,
      _in_reply_to: inReplyTo,
      _from_email: msg.from?.emailAddress?.address ?? null,
      _from_name: msg.from?.emailAddress?.name ?? null,
      _subject: msg.subject ?? null,
      _snippet: msg.bodyPreview ?? null,
      _body: null,
      _received_at: msg.receivedDateTime,
      _email_account_id: acc.id,
    });
    if (reply) inserted++;
  }
  return { scanned, inserted };
}

function normalizeMsgId(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/<([^>]+)>/);
  return m ? m[1] : v.trim().replace(/^<|>$/g, "");
}

function parseFromHeader(s: string): { email: string | null; name: string | null } {
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] ?? "").trim() || null, email: m[2].trim() };
  return { name: null, email: s.trim() || null };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}