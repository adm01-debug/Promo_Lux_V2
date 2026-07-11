// Motor de envio de campanhas (Engagement Engine)
// Processa campaign_recipients pendentes/enfileirados de campanhas ativas,
// envia o e-mail da etapa atual usando a conta OAuth conectada da organização
// (Gmail/Outlook) e registra eventos via record_campaign_event.
//
// Isolamento multi-tenant: cada destinatário é processado dentro do escopo da
// sua organization_id, e a conta de e-mail usada é obrigatoriamente da MESMA
// organização. Nunca há envio cruzado entre organizações.
//
// Idempotência: só destinatários com status 'pending' ou 'queued' são
// processados; ao enviar, o status vira 'sent'. Em caso de falha, registramos
// 'failed' sem reprocessar em loop.
//
// Acionamento: cron (sem body) processa todas as campanhas ativas; POST com
// { campaign_id } processa apenas aquela campanha (trigger manual).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_PER_CAMPAIGN = 25; // limite defensivo por ciclo para respeitar rate limits do provedor

interface EmailAccount {
  id: string;
  user_id: string;
  provider: "gmail" | "outlook";
  email: string;
  display_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  organization_id: string | null;
  scope_type: "user" | "organization";
  reconnect_required: boolean;
}

interface Recipient {
  id: string;
  organization_id: string;
  campaign_id: string;
  email: string;
  full_name: string | null;
  status: string;
  current_step: number;
  next_action_at: string | null;
  sequence_completed_at: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  organization_id: string;
  sequence: unknown;
}

interface SequenceStep {
  id?: string;
  type?: string;
  label?: string;
  subject?: string;
  body?: string;
  // Campos de espera (step do tipo "wait"/"delay"): duração até a próxima etapa.
  days?: number;
  hours?: number;
  minutes?: number;
  waitDays?: number;
  waitHours?: number;
  delay?: number; // dias (compat legado)
}

function isFatalRefreshError(payload: unknown): boolean {
  const s = JSON.stringify(payload ?? "").toLowerCase();
  return (
    s.includes("invalid_grant") ||
    s.includes("invalid_client") ||
    s.includes("aadsts70008") ||
    s.includes("aadsts50173") ||
    s.includes("aadsts700082")
  );
}

class RefreshError extends Error {
  fatal: boolean;
  constructor(message: string, fatal: boolean) {
    super(message);
    this.fatal = fatal;
    this.name = "RefreshError";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Trigger manual: { campaign_id }
  let campaignFilter: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.campaign_id === "string" && /^[0-9a-f-]{36}$/i.test(body.campaign_id)) {
        campaignFilter = body.campaign_id;
      }
    }
  } catch { /* ignore */ }

  let cq = admin
    .from("campaigns")
    .select("id, name, status, organization_id, sequence")
    .eq("status", "active")
    .is("deleted_at", null);
  if (campaignFilter) cq = cq.eq("id", campaignFilter);

  const { data: campaigns, error: campErr } = await cq;
  if (campErr) return json({ error: campErr.message }, 500);

  const results: Record<string, unknown>[] = [];

  for (const campaign of (campaigns ?? []) as Campaign[]) {
    try {
      const res = await processCampaign(admin, campaign);
      results.push({ campaign_id: campaign.id, ...res });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`campaign ${campaign.id} failed:`, msg);
      results.push({ campaign_id: campaign.id, error: msg });
    }
  }

  return json({ processed_campaigns: results.length, results });
});

async function processCampaign(admin: SupabaseClient, campaign: Campaign) {
  // Conta de e-mail ativa da MESMA organização (isolamento multi-tenant).
  const { data: accounts, error: accErr } = await admin
    .from("email_accounts")
    .select("id,user_id,provider,email,display_name,access_token,refresh_token,expires_at,organization_id,scope_type,reconnect_required")
    .eq("organization_id", campaign.organization_id)
    .eq("active", true)
    .eq("reconnect_required", false)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (accErr) throw new Error(`load email account: ${accErr.message}`);
  const account = (accounts?.[0] as EmailAccount | undefined) ?? undefined;
  if (!account) {
    return { skipped: true, reason: "no active email account for organization", sent: 0, failed: 0 };
  }

  // Normaliza a sequência: lista de etapas (email/wait). Sem etapas → nada a fazer.
  const steps = normalizeSequence(campaign.sequence, campaign.name);
  if (steps.length === 0) {
    return { skipped: true, reason: "empty sequence", sent: 0, failed: 0 };
  }

  // Destinatários prontos para a PRÓXIMA etapa:
  //  - sequência ainda não concluída
  //  - horário de próxima ação já chegou (respeita waits/delays)
  //  - não responderam / descadastraram / bounce (reply-detection pausa a sequência)
  const nowIso = new Date().toISOString();
  const { data: recipients, error: recErr } = await admin
    .from("campaign_recipients")
    .select("id,organization_id,campaign_id,email,full_name,status,current_step,next_action_at,sequence_completed_at")
    .eq("campaign_id", campaign.id)
    .eq("organization_id", campaign.organization_id) // defesa extra de isolamento
    .is("sequence_completed_at", null)
    .not("status", "in", "(replied,unsubscribed,bounced)")
    .lte("next_action_at", nowIso)
    .order("next_action_at", { ascending: true })
    .limit(BATCH_PER_CAMPAIGN);

  if (recErr) throw new Error(`load recipients: ${recErr.message}`);
  if (!recipients || recipients.length === 0) {
    return { skipped: false, reason: "no recipients ready", sent: 0, failed: 0 };
  }


  let fresh: EmailAccount;
  try {
    fresh = await ensureFreshToken(admin, account);
  } catch (e) {
    if (e instanceof RefreshError && e.fatal) {
      await admin.from("email_accounts")
        .update({ reconnect_required: true, last_error: e.message })
        .eq("id", account.id);
    }
    throw new Error(`token refresh: ${e instanceof Error ? e.message : String(e)}`);
  }

  let sent = 0;
  let failed = 0;
  let waiting = 0;
  let completed = 0;

  for (const r of recipients as Recipient[]) {
    // Determina a etapa corrente. Fora dos limites → conclui a sequência.
    let stepIdx = clampStep(r.current_step, steps.length);
    if (stepIdx >= steps.length) {
      await admin.rpc("advance_recipient_step", {
        _recipient_id: r.id, _next_step: steps.length, _next_action_at: new Date().toISOString(),
        _completed: true, _error: null,
      });
      completed++;
      continue;
    }

    // Etapas de espera (wait/delay): apenas agenda a próxima ação e avança.
    const cur = steps[stepIdx];
    if (isWaitStep(cur)) {
      const nextAt = new Date(Date.now() + waitMs(cur)).toISOString();
      const isLast = stepIdx + 1 >= steps.length;
      await admin.rpc("advance_recipient_step", {
        _recipient_id: r.id, _next_step: stepIdx + 1, _next_action_at: nextAt,
        _completed: isLast, _error: null,
      });
      if (isLast) completed++; else waiting++;
      continue;
    }

    // Etapa de e-mail: validação defensiva do endereço.
    if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
      await admin.rpc("record_campaign_event", {
        _recipient_id: r.id, _event_type: "failed", _url: null, _ip: null, _ua: null,
      });
      await admin.rpc("advance_recipient_step", {
        _recipient_id: r.id, _next_step: steps.length, _next_action_at: new Date().toISOString(),
        _completed: true, _error: "invalid email address",
      });
      failed++;
      continue;
    }

    const subject = personalize(cur.subject?.trim() || campaign.name, r);
    const body = personalize(cur.body?.trim() || defaultBody(campaign.name), r);

    // Reutiliza thread da primeira mensagem para manter o encadeamento (follow-ups).
    const thread = await firstThreadFor(admin, r.id);

    try {
      const meta = fresh.provider === "gmail"
        ? await sendGmail(fresh, r.email, subject, body, thread)
        : await sendOutlook(fresh, r.email, subject, body);

      // Registra a mensagem enviada (threading para reply-detection).
      // Idempotência garantida pelo índice único (recipient_id, step_index).
      const { error: msgErr } = await admin.from("campaign_messages").insert({
        organization_id: r.organization_id,
        user_id: fresh.user_id,
        campaign_id: r.campaign_id,
        recipient_id: r.id,
        email_account_id: fresh.id,
        step_index: stepIdx,
        provider: fresh.provider,
        provider_message_id: meta.providerMessageId,
        rfc822_message_id: meta.rfc822MessageId,
        thread_id: meta.threadId ?? thread?.threadId ?? null,
        subject,
        sent_at: new Date().toISOString(),
      });
      // Conflito de unicidade = etapa já enviada; segue sem duplicar evento.
      if (msgErr && !/duplicate key|unique/i.test(msgErr.message)) {
        throw new Error(msgErr.message);
      }

      // Evento "sent" apenas na primeira mensagem da sequência (métrica de envio).
      if (stepIdx === 0) {
        await admin.rpc("record_campaign_event", {
          _recipient_id: r.id, _event_type: "sent", _url: null, _ip: null, _ua: null,
        });
      }

      // Avança para a próxima etapa; se era a última, conclui.
      const isLast = stepIdx + 1 >= steps.length;
      await admin.rpc("advance_recipient_step", {
        _recipient_id: r.id,
        _next_step: stepIdx + 1,
        _next_action_at: new Date().toISOString(),
        _completed: isLast,
        _error: null,
      });
      sent++;
      if (isLast) completed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`send to ${r.email} failed:`, msg);
      if (stepIdx === 0) {
        await admin.rpc("record_campaign_event", {
          _recipient_id: r.id, _event_type: "failed", _url: null, _ip: null, _ua: null,
        });
      }
      // Reprograma nova tentativa em 1h (não avança a etapa) e registra o erro.
      await admin.rpc("advance_recipient_step", {
        _recipient_id: r.id,
        _next_step: stepIdx,
        _next_action_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        _completed: false,
        _error: msg.slice(0, 500),
      });
      failed++;
    }
  }

  return { skipped: false, sent, failed, waiting, completed, account: fresh.email };
}

/** Normaliza a sequência JSONB em uma lista de etapas ordenadas (email/wait). */
function normalizeSequence(sequence: unknown, campaignName: string): SequenceStep[] {
  if (!Array.isArray(sequence)) return [];
  const steps = (sequence as SequenceStep[]).filter(
    (s) => s && typeof s === "object",
  );
  // Se não houver nenhuma etapa de e-mail, cria uma etapa padrão única.
  if (!steps.some((s) => !isWaitStep(s))) {
    return [{ type: "email", subject: campaignName, body: defaultBody(campaignName) }];
  }
  return steps;
}

function isWaitStep(step: SequenceStep): boolean {
  const t = (step.type || "").toLowerCase();
  return t === "wait" || t === "delay";
}

/** Duração de uma etapa de espera em milissegundos (mínimo 1 minuto). */
function waitMs(step: SequenceStep): number {
  const days = num(step.days) + num(step.waitDays) + num(step.delay);
  const hours = num(step.hours) + num(step.waitHours);
  const minutes = num(step.minutes);
  const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
  return ms > 0 ? ms : 60 * 1000;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clampStep(step: unknown, len: number): number {
  const n = typeof step === "number" && Number.isFinite(step) ? Math.floor(step) : 0;
  return n < 0 ? 0 : Math.min(n, len);
}

/** Recupera thread/RFC id da primeira mensagem enviada ao destinatário (para follow-ups). */
async function firstThreadFor(
  admin: SupabaseClient,
  recipientId: string,
): Promise<{ threadId: string | null; rfc822: string | null } | null> {
  const { data } = await admin
    .from("campaign_messages")
    .select("thread_id, rfc822_message_id")
    .eq("recipient_id", recipientId)
    .order("step_index", { ascending: true })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return { threadId: row.thread_id ?? null, rfc822: row.rfc822_message_id ?? null };
}



function defaultBody(campaignName: string): string {
  return `Olá {{nome}},\n\nEntramos em contato através da campanha "${campaignName}".\n\nAtenciosamente,\nEquipe LUX IA`;
}

function personalize(text: string, r: Recipient): string {
  const first = (r.full_name || "").split(" ")[0] || "";
  return text
    .replace(/\{\{\s*nome\s*\}\}/gi, first || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email);
}

async function ensureFreshToken(admin: SupabaseClient, acc: EmailAccount): Promise<EmailAccount> {
  const expires = acc.expires_at ? new Date(acc.expires_at).getTime() : 0;
  if (expires > Date.now() + 30_000 && acc.access_token) return acc;
  if (!acc.refresh_token) throw new RefreshError("No refresh token; reconnect required", true);

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
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      refresh_token: acc.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await r.json();
  if (!r.ok) throw new RefreshError(`Refresh failed: ${JSON.stringify(tokens)}`, isFatalRefreshError(tokens));

  const newExpires = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  await admin.from("email_accounts").update({
    access_token: tokens.access_token,
    expires_at: newExpires,
    refresh_token: tokens.refresh_token ?? acc.refresh_token,
  }).eq("id", acc.id);

  return { ...acc, access_token: tokens.access_token, expires_at: newExpires };
}

interface SendMeta {
  providerMessageId: string | null;
  rfc822MessageId: string | null;
  threadId: string | null;
}

function buildRfc822Id(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendGmail(
  acc: EmailAccount,
  to: string,
  subject: string,
  body: string,
  thread?: { threadId: string | null; rfc822: string | null } | null,
): Promise<SendMeta> {
  const fromDomain = acc.email.split("@")[1] || "lux.ai";
  const rfc822Id = buildRfc822Id(fromDomain);
  const fromName = acc.display_name || acc.email;
  const headers = [
    `From: ${fromName} <${acc.email}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    `Message-ID: ${rfc822Id}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
  ];
  // Encadeamento de follow-ups: referencia a mensagem original.
  if (thread?.rfc822) {
    headers.push(`In-Reply-To: ${thread.rfc822}`);
    headers.push(`References: ${thread.rfc822}`);
  }
  const mime = [...headers, ``, body].join("\r\n");

  const payload: Record<string, unknown> = { raw: encodeBase64Url(mime) };
  if (thread?.threadId) payload.threadId = thread.threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${acc.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send [${res.status}]: ${JSON.stringify(data)}`);
  return { providerMessageId: data.id ?? null, rfc822MessageId: rfc822Id, threadId: data.threadId ?? null };
}


async function sendOutlook(acc: EmailAccount, to: string, subject: string, body: string): Promise<SendMeta> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${acc.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Outlook send [${res.status}]: ${txt}`);
  }
  // sendMail retorna 202 sem corpo; sem IDs de mensagem imediatos.
  return { providerMessageId: null, rfc822MessageId: null, threadId: null };
}

function encodeMimeSubject(subject: string): string {
  // Codifica assunto se contiver caracteres não-ASCII (RFC 2047).
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
