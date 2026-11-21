// Envio dos relatorios agendados de Analytics.
//
// Acionamento: pg_cron (sem body) processa todos os agendamentos vencidos.
// O "vencido" e calculado pela propria funcao a partir de frequency +
// day_of_week/day_of_month/hour_utc, comparando com last_sent_at — assim nao
// existe estado extra para dessincronizar.
//
// Idempotencia: a linha em scheduled_report_runs tem unique index por
// (report_id, period_start) com status pending/sent, entao duas invocacoes
// concorrentes nao geram dois envios do mesmo periodo.
//
// Isolamento multi-tenant: envia apenas pela conta de e-mail da MESMA
// organization_id do agendamento. Nunca ha envio cruzado.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isCronAuthorized } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailAccount {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  display_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  organization_id: string | null;
  reconnect_required: boolean;
}

interface ScheduledReport {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  metric: "conversion" | "enrichment" | "pipeline" | "campaigns";
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  hour_utc: number;
  recipients: string[];
  filters: Record<string, unknown>;
  last_sent_at: string | null;
}

const MAX_RECIPIENTS = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Inicio do periodo corrente conforme a frequencia, em UTC. */
function periodStart(now: Date, frequency: string): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (frequency === "weekly") {
    // Semana ISO comecando na segunda-feira.
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
  } else if (frequency === "monthly") {
    d.setUTCDate(1);
  }
  return d;
}

/**
 * Decide se o relatorio deve rodar agora.
 * Regra: passou do horario configurado, o dia bate com a frequencia e ainda
 * nao houve envio no periodo corrente.
 */
function isDue(r: ScheduledReport, now: Date): boolean {
  if (now.getUTCHours() < r.hour_utc) return false;

  if (r.frequency === "weekly") {
    const target = r.day_of_week ?? 1;
    if (now.getUTCDay() !== target) return false;
  } else if (r.frequency === "monthly") {
    const target = r.day_of_month ?? 1;
    if (now.getUTCDate() !== target) return false;
  }

  const start = periodStart(now, r.frequency);
  if (r.last_sent_at && new Date(r.last_sent_at) >= start) return false;
  return true;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function pct(a: number, b: number): string {
  if (!b) return "0,0%";
  return `${((a / b) * 100).toFixed(1).replace(".", ",")}%`;
}

interface Section {
  label: string;
  value: string;
}

/** Consulta os numeros do periodo e devolve as linhas do e-mail. */
async function collectMetrics(
  admin: SupabaseClient,
  r: ScheduledReport,
  start: Date,
  end: Date,
): Promise<{ title: string; rows: Section[] }> {
  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  if (r.metric === "conversion") {
    const [prospects, meetings] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true })
        .gte("created_at", fromIso).lte("created_at", toIso).is("deleted_at", null),
      admin.from("deals").select("id", { count: "exact", head: true })
        .gte("created_at", fromIso).lte("created_at", toIso),
    ]);
    const p = prospects.count ?? 0;
    const m = meetings.count ?? 0;
    return {
      title: "Conversao & ROI",
      rows: [
        { label: "Novas empresas", value: fmt(p) },
        { label: "Novos negocios", value: fmt(m) },
        { label: "Taxa de conversao", value: pct(m, p) },
      ],
    };
  }

  if (r.metric === "enrichment") {
    const [total, enriched] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true })
        .gte("created_at", fromIso).lte("created_at", toIso).is("deleted_at", null),
      admin.from("companies").select("id", { count: "exact", head: true })
        .gte("created_at", fromIso).lte("created_at", toIso)
        .is("deleted_at", null).eq("enriched", true),
    ]);
    const t = total.count ?? 0;
    const e = enriched.count ?? 0;
    return {
      title: "Enriquecimento",
      rows: [
        { label: "Empresas no periodo", value: fmt(t) },
        { label: "Enriquecidas", value: fmt(e) },
        { label: "Cobertura", value: pct(e, t) },
      ],
    };
  }

  if (r.metric === "pipeline") {
    const { data } = await admin
      .from("deals")
      .select("value")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .is("deleted_at", null);
    const rows = (data ?? []) as Array<{ value: number | null }>;
    const total = rows.reduce((s, d) => s + (Number(d.value) || 0), 0);
    return {
      title: "Pipeline",
      rows: [
        { label: "Negocios abertos", value: fmt(rows.length) },
        { label: "Valor total", value: `R$ ${fmt(Math.round(total))}` },
        { label: "Ticket medio", value: rows.length ? `R$ ${fmt(Math.round(total / rows.length))}` : "R$ 0" },
      ],
    };
  }

  // campaigns
  const { data } = await admin
    .from("campaign_events")
    .select("event_type")
    .gte("occurred_at", fromIso)
    .lte("occurred_at", toIso);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const t = (row as { event_type: string }).event_type;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return {
    title: "Campanhas",
    rows: [
      { label: "Enviados", value: fmt(counts["sent"] ?? 0) },
      { label: "Abertos", value: fmt(counts["open"] ?? 0) },
      { label: "Respostas", value: fmt(counts["reply"] ?? 0) },
      { label: "Cliques", value: fmt(counts["click"] ?? 0) },
    ],
  };
}

function buildEmail(name: string, payload: { title: string; rows: Section[] }, start: Date, end: Date) {
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const subject = `[LUX] ${name} — ${fmtDate(start)} a ${fmtDate(end)}`;

  const text = [
    `Relatorio: ${name}`,
    `Periodo: ${fmtDate(start)} a ${fmtDate(end)}`,
    ``,
    payload.title,
    ...payload.rows.map((r) => `  ${r.label}: ${r.value}`),
    ``,
    `Enviado automaticamente pelo LUX IA.`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px;font-size:18px">${name}</h2>
  <p style="margin:0 0 16px;color:#666;font-size:13px">Periodo: ${fmtDate(start)} a ${fmtDate(end)}</p>
  <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#888">${payload.title}</h3>
  <table style="border-collapse:collapse;width:100%">
    ${payload.rows.map((r) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${r.label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;text-align:right">${r.value}</td>
    </tr>`).join("")}
  </table>
  <p style="margin:20px 0 0;color:#999;font-size:12px">Enviado automaticamente pelo LUX IA.</p>
</div>`;

  return { subject, text, html };
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeMimeSubject(s: string): string {
  // RFC 2047: assunto sempre em UTF-8 base64, evita quebra de acento.
  return `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`;
}

async function ensureFreshToken(admin: SupabaseClient, acc: EmailAccount): Promise<EmailAccount> {
  const expires = acc.expires_at ? new Date(acc.expires_at).getTime() : 0;
  if (expires > Date.now() + 30_000 && acc.access_token) return acc;
  if (!acc.refresh_token) throw new Error("Sem refresh token; reconexao necessaria");

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
  if (!clientId || !secret) throw new Error(`OAuth nao configurado para ${acc.provider}`);

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
  if (!r.ok) {
    const code = typeof tokens?.error === "string" ? tokens.error : "unknown_error";
    throw new Error(`Refresh falhou: ${code}`);
  }
  const newExpires = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  await admin.from("email_accounts").update({
    access_token: tokens.access_token,
    expires_at: newExpires,
    refresh_token: tokens.refresh_token ?? acc.refresh_token,
  }).eq("id", acc.id);
  return { ...acc, access_token: tokens.access_token, expires_at: newExpires };
}

async function sendMail(acc: EmailAccount, to: string, subject: string, text: string, html: string): Promise<void> {
  const fromName = acc.display_name || acc.email;
  const domain = acc.email.split("@")[1] || "lux.ai";
  const rfc822 = `<${crypto.randomUUID()}@${domain}>`;
  const boundary = "lux-report-boundary";

  const mime = [
    `From: ${fromName} <${acc.email}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    `Message-ID: ${rfc822}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    text,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    html,
    `--${boundary}--`,
    ``,
  ].join("\r\n");

  const raw = encodeBase64Url(mime);

  if (acc.provider === "gmail") {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${acc.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail send [${res.status}]: ${body.slice(0, 300)}`);
    }
    return;
  }

  // Outlook / Microsoft Graph: usa o endpoint sendMail com o MIME cru.
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${acc.access_token}`, "Content-Type": "text/plain" },
    body: mime,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Outlook send [${res.status}]: ${body.slice(0, 300)}`);
  }
}

async function processReport(
  admin: SupabaseClient,
  r: ScheduledReport,
  now: Date,
): Promise<{ id: string; status: string; detail?: string }> {
  const start = periodStart(now, r.frequency);
  const end = now;

  // Conta remetente: precisa ser da mesma organizacao do agendamento.
  let accountsQuery = admin
    .from("email_accounts")
    .select("id,user_id,provider,email,display_name,access_token,refresh_token,expires_at,organization_id,reconnect_required")
    .eq("reconnect_required", false)
    .order("created_at", { ascending: true })
    .limit(1);
  if (r.organization_id) {
    accountsQuery = accountsQuery.eq("organization_id", r.organization_id);
  } else {
    accountsQuery = accountsQuery.eq("user_id", r.user_id);
  }

  const { data: accounts } = await accountsQuery;
  const account = (accounts ?? [])[0] as EmailAccount | undefined;
  if (!account) {
    return { id: r.id, status: "skipped", detail: "Nenhuma conta de e-mail ativa na organizacao" };
  }

  const recipients = (r.recipients ?? []).filter((e) => typeof e === "string" && e.includes("@")).slice(0, MAX_RECIPIENTS);
  if (!recipients.length) {
    return { id: r.id, status: "skipped", detail: "Nenhum destinatario valido" };
  }

  // Reserva o periodo antes de enviar: o unique index impede dupla reserva.
  const { error: reserveErr } = await admin.from("scheduled_report_runs").insert({
    report_id: r.id,
    user_id: r.user_id,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    status: "pending",
    recipients_count: recipients.length,
  });
  if (reserveErr) {
    // 23505 = unique_violation: outro processo ja reservou este periodo.
    if ((reserveErr as { code?: string }).code === "23505") {
      return { id: r.id, status: "skipped", detail: "Periodo ja enviado" };
    }
    throw new Error(`reserva do periodo: ${reserveErr.message}`);
  }

  try {
    const payload = await collectMetrics(admin, r, start, end);
    const mail = buildEmail(r.name, payload, start, end);
    const fresh = await ensureFreshToken(admin, account);

    const failures: string[] = [];
    for (const to of recipients) {
      try {
        await sendMail(fresh, to, mail.subject, mail.text, mail.html);
      } catch (e) {
        failures.push(`${to}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (failures.length === recipients.length) {
      throw new Error(`todos os envios falharam: ${failures[0]}`);
    }

    await admin.from("scheduled_report_runs").update({
      status: "sent",
      payload: payload as unknown as Record<string, unknown>,
      error_message: failures.length ? failures.join("; ").slice(0, 500) : null,
    }).eq("report_id", r.id).eq("period_start", start.toISOString()).eq("status", "pending");

    await admin.from("scheduled_reports").update({ last_sent_at: new Date().toISOString() }).eq("id", r.id);

    return { id: r.id, status: "sent", detail: failures.length ? `${failures.length} falha(s)` : undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("scheduled_report_runs").update({
      status: "failed",
      error_message: message.slice(0, 500),
    }).eq("report_id", r.id).eq("period_start", start.toISOString()).eq("status", "pending");
    return { id: r.id, status: "failed", detail: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isCronAuthorized(req)) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const now = new Date();
    const { data: reports, error } = await admin
      .from("scheduled_reports")
      .select("id,user_id,organization_id,name,metric,frequency,day_of_week,day_of_month,hour_utc,recipients,filters,last_sent_at")
      .eq("active", true)
      .is("deleted_at", null);

    if (error) throw new Error(`leitura dos agendamentos: ${error.message}`);

    const due = ((reports ?? []) as ScheduledReport[]).filter((r) => isDue(r, now));
    const results: Array<{ id: string; status: string; detail?: string }> = [];

    for (const r of due) {
      try {
        results.push(await processReport(admin, r, now));
      } catch (e) {
        results.push({ id: r.id, status: "failed", detail: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({
      ok: true,
      checked: (reports ?? []).length,
      due: due.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});